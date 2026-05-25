import { CommeetService } from '~/server/services/CommeetService';
import { ExcelService } from '~/server/services/ExcelService';
import { DatabaseService } from '~/server/services/DatabaseService';
import { TableMigrationService } from '~/server/services/TableMigrationService';
import { reimbursementTableSchema } from '~/server/services/TableDefinitionService';
import { automationLogger } from '~/server/services/LoggerService';
import { EmailService } from '~/server/services/EmailService';
import { DateHelper } from '~/server/utils/dateHelper';
import { evaluateCommeetSyncHolidayGate } from '~/server/utils/commeetSyncHolidayGate';
import {
  withAutomationIoTiming,
} from '~/server/utils/automationIoLog';
import { CommeetSyncRunLogCollector } from '~/server/utils/commeetSyncRunLog';

// 資料表名稱
const TABLE_NAME = 'ExpendForm';
const JOB_NAME = 'COMMEET_SYNC';

function buildSyncLogAttachment(runLog: CommeetSyncRunLogCollector) {
  return {
    filename: runLog.getAttachmentFilename(),
    content: runLog.toAttachmentContent(),
  };
}

interface SyncRequestBody {
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string; // YYYY-MM-DD
  /** 為 true 時略過台灣行政機關休假日檢查（手動補跑等） */
  skipHolidayCheck?: boolean;
}

/**
 * COMMEET 報表同步 API
 *
 * POST /api/commeet/sync
 *
 * 完整流程：
 * 1. Puppeteer 登入 → 取得 Cookie
 * 2. 用 Cookie 呼叫 listDocByPageExcel API → 下載 Excel
 * 3. 解析 Excel 檔案（用 xlsx 套件，在記憶體中處理）
 * 4. UPSERT 到 SQL Server（ExpendForm 資料表）
 * 5. 記錄變更到 ExpendForm_ChangeLog（付款狀態、實際付款日期等）
 * 
 * 預設日期範圍：由 COMMEET_SYNC_DEFAULT_DAYS 決定（可透過 body 覆寫）
 *
 * 排程略過：預設若「今天」為台灣行政機關休假日（tw-holiday），回傳 success 並標示 skipped（見 COMMEET_SYNC_SKIP_ON_TW_HOLIDAY）。
 */
const DEFAULT_DAYS_MIN = 1;
const DEFAULT_DAYS_MAX = 180;

function getDefaultSyncDays(): number {
  const raw = process.env.COMMEET_SYNC_DEFAULT_DAYS;
  const n = raw ? parseInt(raw, 10) : 7;
  if (!Number.isFinite(n) || n < DEFAULT_DAYS_MIN) return DEFAULT_DAYS_MIN;
  if (n > DEFAULT_DAYS_MAX) return DEFAULT_DAYS_MAX;
  return n;
}

export default defineEventHandler(async (event) => {
  const startTime = Date.now();
  let dateRange: { start: string; end: string } | undefined;
  const runLog = new CommeetSyncRunLogCollector();

  const sendAutomationNotificationNonBlocking = (
    payload: Parameters<typeof EmailService.sendAutomationNotification>[0],
    warnMessage: string,
  ): void => {
    EmailService.sendAutomationNotification(payload).catch((error) => {
      automationLogger.warn(warnMessage, {
        error,
      });
    });
  };

  try {
    // readBody 在空 body 時可能 resolve undefined（例如 curl 未帶 -d），需正規化
    const rawBody = await readBody<SyncRequestBody>(event).catch(() => undefined);
    const body: SyncRequestBody =
      rawBody != null &&
      typeof rawBody === 'object' &&
      !Array.isArray(rawBody)
        ? rawBody
        : {};
    if (rawBody == null) {
      automationLogger.debug('sync_request_body_absent', { job: JOB_NAME });
    } else if (typeof rawBody !== 'object' || Array.isArray(rawBody)) {
      automationLogger.debug('sync_request_body_ignored_non_object', {
        job: JOB_NAME,
        valueType: typeof rawBody,
      });
    }

    const tHoliday = Date.now();
    const holidayGate = await evaluateCommeetSyncHolidayGate({
      localDateYmd: DateHelper.today(),
      skipHolidayCheck: body.skipHolidayCheck === true,
    });
    const holidayMs = Date.now() - tHoliday;
    if (!holidayGate.proceed) {
      const duration = Date.now() - startTime;
      runLog.append('tw_holiday_gate_skipped', {
        localDate: holidayGate.localDate,
        message: holidayGate.message,
        ms: holidayMs,
        totalMs: duration,
      });
      automationLogger.info('io_complete', {
        job: JOB_NAME,
        operation: 'tw_holiday_gate',
        outcome: 'skipped_rest_day',
        ok: true,
        ms: holidayMs,
        totalMs: duration,
        localDate: holidayGate.localDate,
      });
      return {
        success: true,
        skipped: true,
        message: holidayGate.message,
        data: {
          localDate: holidayGate.localDate,
          duration: `${duration}ms`,
        },
      };
    }

    automationLogger.info('io_complete', {
      job: JOB_NAME,
      operation: 'tw_holiday_gate',
      outcome: 'proceed',
      ok: true,
      ms: holidayMs,
    });

    const defaultDays = getDefaultSyncDays();
    const getDefaultDateRange = (): { start: string; end: string } => {
      return {
        start: DateHelper.daysAgo(defaultDays),
        end: DateHelper.today(),
      };
    };

    dateRange =
      body.dateStart && body.dateEnd
        ? { start: body.dateStart, end: body.dateEnd }
        : getDefaultDateRange();

    automationLogger.info('sync_run', {
      job: JOB_NAME,
      dateRange,
    });
    runLog.append('sync_run', { job: JOB_NAME, dateRange });

    await withAutomationIoTiming(
      'mssql_test_connection',
      { target: TABLE_NAME },
      async () => {
        const dbConnected = await DatabaseService.testConnection();
        if (!dbConnected) throw new Error('資料庫連接失敗');
      },
      runLog,
    );

    await withAutomationIoTiming(
      'mssql_ensure_table',
      { table: TABLE_NAME },
      async () => {
        await TableMigrationService.ensureTableStructure(
          TABLE_NAME,
          reimbursementTableSchema,
        );
      },
      runLog,
    );

    const commeetService = new CommeetService();
    const downloadResult = await withAutomationIoTiming(
      'commeet_download_flow',
      { dateRange },
      () => commeetService.downloadReportFlow(dateRange),
      runLog,
    );

    if (!downloadResult.success) {
      throw new Error(`Excel 下載失敗: ${downloadResult.message}`);
    }
    // 查無符合條件表單時 COMMEET 回 400「查無此表單」，已視為成功但無 buffer
    if (!downloadResult.buffer) {
      const duration = Date.now() - startTime;
      runLog.append('sync_done', {
        ok: true,
        ms: duration,
        outcome: 'no_excel_buffer',
        insertedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        dupPaymentAlignedCount: 0,
      });
      sendAutomationNotificationNonBlocking(
        {
        success: true,
        message: '同步完成，但沒有資料需要處理',
          jobName: JOB_NAME,
        runTime: new Date().toISOString(),
        dateRange,
        duration: `${duration}ms`,
        excelStats: {
          totalRows: 0,
          validRows: 0,
          skippedRows: 0,
        },
        databaseStats: {
          tableName: TABLE_NAME,
          insertedCount: 0,
          skippedCount: 0,
          errorCount: 0,
          dupPaymentAlignedCount: 0,
        },
        logAttachment: buildSyncLogAttachment(runLog),
        },
        'Email 通知發送失敗（不影響同步流程）',
      );
      return {
        success: true,
        message: '同步完成，但沒有資料需要處理',
        data: {
          excelStats: {
            totalRows: 0,
            validRows: 0,
            skippedRows: 0,
          },
          databaseStats: {
            insertedCount: 0,
            skippedCount: 0,
            errorCount: 0,
          },
          duration: `${duration}ms`,
        },
      };
    }

    const excelBuffer = downloadResult.buffer;

    const parsedData = await withAutomationIoTiming(
      'excel_parse_buffer',
      {
        fileName: downloadResult.fileName,
        bufferSize: excelBuffer.length,
      },
      () => ExcelService.parseExcelFromBuffer(excelBuffer),
      runLog,
    );

    const excelParsed = {
      job: JOB_NAME,
      totalRows: parsedData.totalRows,
      validRows: parsedData.validRows,
      skippedRows: parsedData.skippedRows,
      headerSample: parsedData.headers.slice(0, 10),
    };
    automationLogger.info('excel_parsed', excelParsed);
    runLog.append('excel_parsed', excelParsed);

    if (parsedData.rows.length === 0) {
      const duration = Date.now() - startTime;
      runLog.append('sync_done', {
        ok: true,
        ms: duration,
        outcome: 'no_valid_rows',
        insertedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        dupPaymentAlignedCount: 0,
      });
      sendAutomationNotificationNonBlocking(
        {
          success: true,
          message: '同步完成，但沒有資料需要處理',
          jobName: JOB_NAME,
          runTime: new Date().toISOString(),
          dateRange,
          duration: `${duration}ms`,
          fileName: downloadResult.fileName,
          excelStats: {
            totalRows: parsedData.totalRows,
            validRows: 0,
            skippedRows: parsedData.skippedRows,
            headers: parsedData.headers,
          },
          databaseStats: {
            tableName: TABLE_NAME,
            insertedCount: 0,
            skippedCount: 0,
            errorCount: 0,
            dupPaymentAlignedCount: 0,
          },
          logAttachment: buildSyncLogAttachment(runLog),
        },
        'Email 通知發送失敗（不影響同步流程）',
      );
      return {
        success: true,
        message: '同步完成，但沒有資料需要處理',
        data: {
          excelStats: {
            totalRows: parsedData.totalRows,
            validRows: 0,
            skippedRows: parsedData.skippedRows,
          },
          databaseStats: {
            insertedCount: 0,
            skippedCount: 0,
            errorCount: 0,
          },
          duration: `${Date.now() - startTime}ms`,
        },
      };
    }

    const dbResult = await withAutomationIoTiming(
      'mssql_batch_insert',
      {
        table: TABLE_NAME,
        rowCount: parsedData.rows.length,
        trackChanges: true,
      },
      () =>
        DatabaseService.batchInsertData(parsedData.rows, TABLE_NAME, {
          trackChanges: true,
          trackedFields: ['付款狀態', '實際付款日期'],
          changedBy: 'COMMEET_SYNC',
        }),
      runLog,
    );

    if (!dbResult.success) {
      throw new Error(`資料庫操作失敗: ${dbResult.errors.join(', ')}`);
    }

    const duration = Date.now() - startTime;
    const dupPaymentAlignedCount = dbResult.dupPaymentAlignedCount ?? 0;

    const syncDone = {
      job: JOB_NAME,
      ok: true,
      ms: duration,
      insertedCount: dbResult.insertedCount,
      skippedCount: dbResult.skippedCount,
      errorCount: dbResult.errors.length,
      dupPaymentAlignedCount,
    };
    automationLogger.info('sync_done', syncDone);
    runLog.append('sync_done', syncDone);
    if (dbResult.errors.length > 0) {
      runLog.append('db_errors_sample', {
        errors: dbResult.errors.slice(0, 10),
      });
    }

    sendAutomationNotificationNonBlocking(
      {
        success: true,
        message: 'COMMEET 同步完成',
        jobName: JOB_NAME,
        runTime: new Date().toISOString(),
        dateRange,
        duration: `${duration}ms`,
        fileName: downloadResult.fileName,
        excelStats: {
          totalRows: parsedData.totalRows,
          validRows: parsedData.validRows,
          skippedRows: parsedData.skippedRows,
          headers: parsedData.headers,
        },
        databaseStats: {
          tableName: TABLE_NAME,
          insertedCount: dbResult.insertedCount,
          skippedCount: dbResult.skippedCount,
          errorCount: dbResult.errors.length,
          dupPaymentAlignedCount,
        },
        errors: dbResult.errors.slice(0, 10),
        logAttachment: buildSyncLogAttachment(runLog),
      },
      'Email 通知發送失敗（不影響同步流程）',
    );

    return {
      success: true,
      message: 'COMMEET 同步完成',
      data: {
        fileName: downloadResult.fileName,
        excelStats: {
          totalRows: parsedData.totalRows,
          validRows: parsedData.validRows,
          skippedRows: parsedData.skippedRows,
          headers: parsedData.headers,
        },
        databaseStats: {
          tableName: TABLE_NAME,
          insertedCount: dbResult.insertedCount,
          skippedCount: dbResult.skippedCount,
          errorCount: dbResult.errors.length,
          dupPaymentAlignedCount: dbResult.dupPaymentAlignedCount ?? 0,
        },
        errors: dbResult.errors.slice(0, 10), // 只返回前 10 個錯誤
        duration: `${duration}ms`,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    automationLogger.error('COMMEET 同步失敗', error);
    runLog.append('sync_failed', {
      job: JOB_NAME,
      ok: false,
      ms: Date.now() - startTime,
      error: errorMessage,
    });

    sendAutomationNotificationNonBlocking(
      {
        success: false,
        message: `COMMEET 同步失敗: ${errorMessage}`,
        jobName: JOB_NAME,
        runTime: new Date().toISOString(),
        dateRange,
        duration: `${Date.now() - startTime}ms`,
        errors: [errorMessage],
        logAttachment: buildSyncLogAttachment(runLog),
      },
      '失敗通知 Email 發送失敗（不影響同步流程）',
    );

    throw createError({
      statusCode: 500,
      message: `COMMEET 同步失敗: ${errorMessage}`,
    });
  }
});
