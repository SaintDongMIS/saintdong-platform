import { CommeetService } from '~/server/services/CommeetService';
import { ExcelService } from '~/server/services/ExcelService';
import { DatabaseService } from '~/server/services/DatabaseService';
import { TableMigrationService } from '~/server/services/TableMigrationService';
import { reimbursementTableSchema } from '~/server/services/TableDefinitionService';
import { automationLogger } from '~/server/services/LoggerService';
import { EmailService } from '~/server/services/EmailService';
import { DateHelper } from '~/server/utils/dateHelper';

// 資料表名稱
const TABLE_NAME = 'ExpendForm';
const JOB_NAME = 'COMMEET_SYNC';

interface SyncRequestBody {
  dateStart?: string; // YYYY-MM-DD
  dateEnd?: string; // YYYY-MM-DD
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
    // 解析請求參數（如果沒有提供日期，使用 COMMEET_SYNC_DEFAULT_DAYS）
    const body = await readBody<SyncRequestBody>(event).catch(
      () => ({}) as SyncRequestBody,
    );

    const defaultDays = getDefaultSyncDays();
    const getDefaultDateRange = (): { start: string; end: string } => {
      return {
        start: DateHelper.daysAgo(defaultDays),
        end: DateHelper.today(),
      };
    };

    dateRange =
      body?.dateStart && body?.dateEnd
        ? { start: body.dateStart, end: body.dateEnd }
        : getDefaultDateRange();

    automationLogger.info('開始 COMMEET 同步流程', {
      dateRange,
    });

    // 步驟 1: 驗證資料庫連接
    automationLogger.info('步驟 1: 驗證資料庫連接');
    const dbConnected = await DatabaseService.testConnection();
    if (!dbConnected) {
      throw new Error('資料庫連接失敗');
    }

    // 步驟 2: 確保資料表結構
    automationLogger.info('步驟 2: 確保資料表結構', {
      tableName: TABLE_NAME,
    });
    await TableMigrationService.ensureTableStructure(
      TABLE_NAME,
      reimbursementTableSchema,
    );

    // 步驟 3: 登入並下載 Excel
    automationLogger.info('步驟 3: 登入 COMMEET 並下載 Excel');
    const commeetService = new CommeetService();
    const downloadResult = await commeetService.downloadReportFlow(dateRange);

    if (!downloadResult.success) {
      throw new Error(`Excel 下載失敗: ${downloadResult.message}`);
    }
    // 查無符合條件表單時 COMMEET 回 400「查無此表單」，已視為成功但無 buffer
    if (!downloadResult.buffer) {
      const duration = Date.now() - startTime;
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
        },
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

    automationLogger.info('Excel 下載成功', {
      fileName: downloadResult.fileName,
      bufferSize: downloadResult.buffer.length,
    });

    // 步驟 4: 解析 Excel
    automationLogger.info('步驟 4: 解析 Excel');
    const parsedData = await ExcelService.parseExcelFromBuffer(
      downloadResult.buffer,
    );

    automationLogger.info('Excel 解析完成', {
      totalRows: parsedData.totalRows,
      validRows: parsedData.validRows,
      skippedRows: parsedData.skippedRows,
      headers: parsedData.headers.slice(0, 10), // 只顯示前 10 個欄位
    });

    if (parsedData.rows.length === 0) {
      sendAutomationNotificationNonBlocking(
        {
          success: true,
          message: '同步完成，但沒有資料需要處理',
          jobName: JOB_NAME,
          runTime: new Date().toISOString(),
          dateRange,
          duration: `${Date.now() - startTime}ms`,
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
          },
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

    // 步驟 5: 插入資料庫（複合鍵由 EXPEND_FORM_KEY_SPEC 定義：表單+發票+日期+金額+費用項目+分攤參與部門）
    // 啟用變更追蹤：自動記錄付款狀態、實際付款日期等欄位的變更
    automationLogger.info('步驟 5: 插入資料庫（帶變更追蹤）', {
      tableName: TABLE_NAME,
      rowCount: parsedData.rows.length,
      trackedFields: ['付款狀態', '實際付款日期'],
    });

    const dbResult = await DatabaseService.batchInsertData(
      parsedData.rows,
      TABLE_NAME,
      {
        trackChanges: true,
        trackedFields: ['付款狀態', '實際付款日期'],
        changedBy: 'COMMEET_SYNC',
      }
    );

    if (!dbResult.success) {
      throw new Error(`資料庫操作失敗: ${dbResult.errors.join(', ')}`);
    }

    const duration = Date.now() - startTime;

    automationLogger.info('COMMEET 同步完成', {
      duration: `${duration}ms`,
      insertedCount: dbResult.insertedCount,
      skippedCount: dbResult.skippedCount,
      errorCount: dbResult.errors.length,
    });

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
        },
        errors: dbResult.errors.slice(0, 10),
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
        },
        errors: dbResult.errors.slice(0, 10), // 只返回前 10 個錯誤
        duration: `${duration}ms`,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    automationLogger.error('COMMEET 同步失敗', error);

    sendAutomationNotificationNonBlocking(
      {
        success: false,
        message: `COMMEET 同步失敗: ${errorMessage}`,
        jobName: JOB_NAME,
        runTime: new Date().toISOString(),
        dateRange,
        duration: `${Date.now() - startTime}ms`,
        errors: [errorMessage],
      },
      '失敗通知 Email 發送失敗（不影響同步流程）',
    );

    throw createError({
      statusCode: 500,
      message: `COMMEET 同步失敗: ${errorMessage}`,
    });
  }
});
