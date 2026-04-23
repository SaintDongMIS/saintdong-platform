import { defineEventHandler, setHeader } from 'h3';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import multer from 'multer';
import crypto from 'crypto';
import { BankConverterExcelConfig } from '../constants/bankConverterExcelConfig';
import { BankConverterService } from '../services/BankConverterService';
import {
  insertBankWireExportLedger,
  type BankWireLedgerRow,
} from '../services/BankWireExportLogService';
import { ErrorHandler } from '../utils/errorHandler';
import { apiLogger } from '../services/LoggerService';
import {
  extractCommeetWireExportRows,
  readCommeetSheetMatrix,
} from '../../utils/commeetBankExcelParse';
import { assertWireGroupsSamePayeeBankCode7 } from '../../utils/bankWireMerge';
import {
  applyPayeeResolutionsToWireRows,
  type BankWirePayeeResolutionInput,
} from '../utils/applyBankWirePayeeResolutions';

function taipeiDateParts(now: Date): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  return {
    year: parts.find((p) => p.type === 'year')?.value || '1970',
    month: parts.find((p) => p.type === 'month')?.value || '01',
    day: parts.find((p) => p.type === 'day')?.value || '01',
    hour: parts.find((p) => p.type === 'hour')?.value || '00',
    minute: parts.find((p) => p.type === 'minute')?.value || '00',
    second: parts.find((p) => p.type === 'second')?.value || '00',
  };
}

function createBankWireBatchId(now: Date): string {
  const { year, month, day, hour, minute, second } = taipeiDateParts(now);
  const ts = `${year}${month}${day}-${hour}${minute}${second}`;
  const suffix = crypto
    .randomBytes(3)
    .toString('base64url')
    .toUpperCase()
    .slice(0, 4);
  return `BW-${ts}-${suffix}`;
}

function createBankWireDownloadFilename(now: Date): string {
  const { month, day, hour, minute } = taipeiDateParts(now);
  const timestamp = `${month}${day}${hour}${minute}`;
  return `commeet整批付款_${timestamp}.txt`;
}

/**
 * 國泰網銀付款檔案轉換 API
 *
 * POST /api/bank-convert
 * Content-Type: multipart/form-data
 * Body: file（Commeet「付款資料」.xlsx/.xls）；可選 excludedFormNos（JSON 陣列）；可選 resolutions（JSON 陣列，每筆匯款之 excel／清單決議，與分析 API 列序相同）
 *
 * Response: 轉換後的檔案（Binary，Big5 編碼）
 */
export default defineEventHandler(async (event) => {
  let uploadedFile: Express.Multer.File | null = null;

  try {
    // 驗證方法
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    // 處理檔案上傳（使用 multer：.xlsx / .xls）
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const tempPath = path.join(os.tmpdir(), 'saintdong-uploads');
        try {
          await fs.access(tempPath);
        } catch {
          await fs.mkdir(tempPath, { recursive: true });
        }
        cb(null, tempPath);
      },
      filename: (req, file, cb) => {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.originalname}`;
        cb(null, fileName);
      },
    });

    const upload = multer({
      storage,
      fileFilter: (req: any, file, cb: any) => {
        const fileExtension = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));
        const allowed = ['.xlsx', '.xls'];
        if (allowed.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(
            new Error('只允許上傳付款資料 Excel 檔案（.xlsx、.xls）'),
            false
          );
        }
      },
    });

    uploadedFile = await new Promise<Express.Multer.File>((resolve, reject) => {
      upload.single('file')(
        event.node.req as any,
        event.node.res as any,
        (err: any) => {
          if (err) {
            reject(err);
          } else if (!(event.node.req as any).file) {
            reject(new Error('NO_FILE'));
          } else {
            resolve((event.node.req as any).file);
          }
        }
      );
    });

    // 讀取檔案 Buffer
    apiLogger.info('開始處理銀行轉換請求', {
      filename: uploadedFile.originalname,
      size: uploadedFile.size,
    });

    const inputBuffer = await fs.readFile(uploadedFile.path);

    // 驗證檔案不為空
    if (inputBuffer.length === 0) {
      apiLogger.error('上傳的檔案是空檔案', {
        filename: uploadedFile.originalname,
      });
      throw new Error('上傳的檔案是空檔案');
    }

    const body = (event.node.req as any).body as
      | { excludedFormNos?: string; resolutions?: string }
      | undefined;
    let excludedFormNos = new Set<string>();
    if (body?.excludedFormNos && typeof body.excludedFormNos === 'string') {
      try {
        const parsed = JSON.parse(body.excludedFormNos) as unknown;
        if (Array.isArray(parsed)) {
          excludedFormNos = new Set(
            parsed.map((x) => String(x).trim()).filter(Boolean)
          );
        }
      } catch {
        // 略過非法 JSON，視為不排除任何表單
      }
    }

    let resolutionsPayload: BankWirePayeeResolutionInput[] | null = null;
    if (body?.resolutions && typeof body.resolutions === 'string') {
      const raw = body.resolutions.trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (!Array.isArray(parsed)) {
            throw new Error('resolutions 必須為陣列');
          }
          resolutionsPayload = parsed as BankWirePayeeResolutionInput[];
        } catch (e: any) {
          throw new Error(
            `無法解析 resolutions：${e?.message || 'JSON 格式錯誤'}`
          );
        }
      }
    }

    // 轉換檔案
    const converter = new BankConverterService();
    let outputBuffer: Buffer;
    let ledgerRows: BankWireLedgerRow[];
    try {
      if (resolutionsPayload && resolutionsPayload.length > 0) {
        const cfg = BankConverterExcelConfig;
        const sheet = readCommeetSheetMatrix(inputBuffer, cfg);
        if (!sheet.ok) {
          throw new Error(sheet.error);
        }
        const extracted = extractCommeetWireExportRows(sheet.jsonData, cfg);
        if (!extracted.ok) {
          throw new Error(extracted.error);
        }
        if (resolutionsPayload.length !== extracted.rows.length) {
          throw new Error(
            `決議筆數（${resolutionsPayload.length}）須與匯款列筆數（${extracted.rows.length}）相同`
          );
        }
        const resolvedRows = await applyPayeeResolutionsToWireRows(
          extracted.rows,
          resolutionsPayload
        );
        assertWireGroupsSamePayeeBankCode7(resolvedRows, excludedFormNos);
        const result = converter.convertFromExtractedWireRows(
          { ...extracted, rows: resolvedRows },
          { excludedFormNos }
        );
        outputBuffer = result.outputBuffer;
        ledgerRows = result.ledgerRows;
      } else {
        const result = converter.convertExcelBuffer(inputBuffer, {
          excludedFormNos,
        });
        outputBuffer = result.outputBuffer;
        ledgerRows = result.ledgerRows;
      }
    } catch (convertError: any) {
      apiLogger.error('檔案轉換失敗', convertError, {
        filename: uploadedFile.originalname,
        inputSize: inputBuffer.length,
      });
      throw new Error(`檔案轉換失敗：${convertError.message || '未知錯誤'}`);
    }

    // 驗證轉換結果不為空
    if (!outputBuffer || outputBuffer.length === 0) {
      apiLogger.error('轉換後的檔案為空', {
        filename: uploadedFile.originalname,
        inputSize: inputBuffer.length,
      });
      throw new Error('轉換後的檔案為空，請檢查輸入檔案格式是否正確');
    }

    const now = new Date();
    const batchId = createBankWireBatchId(now);
    try {
      await insertBankWireExportLedger(
        batchId,
        uploadedFile.originalname,
        ledgerRows
      );
    } catch (logErr: any) {
      apiLogger.error('匯出紀錄寫入失敗', logErr, { batchId });
      throw new Error(
        `轉檔成功但紀錄寫入失敗，請勿重複匯款並聯絡管理員：${logErr?.message || '資料庫錯誤'}`
      );
    }

    apiLogger.info('銀行轉換成功', {
      filename: uploadedFile.originalname,
      inputSize: inputBuffer.length,
      outputSize: outputBuffer.length,
      batchId,
      ledgerCount: ledgerRows.length,
    });

    const filename = createBankWireDownloadFilename(now);

    // 設定回應標頭（下載檔案）
    setHeader(event, 'Content-Type', 'text/plain; charset=big5');
    setHeader(
      event,
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`
    );
    setHeader(event, 'Content-Length', outputBuffer.length);

    // 清理暫存檔案
    await fs.unlink(uploadedFile.path).catch(() => {
      // 忽略清理錯誤
    });

    return outputBuffer;
  } catch (error: any) {
    // 清理暫存檔案
    if (uploadedFile) {
      await fs.unlink(uploadedFile.path).catch(() => {
        // 忽略清理錯誤
      });
    }
    ErrorHandler.handleUploadError(error);
  }
});
