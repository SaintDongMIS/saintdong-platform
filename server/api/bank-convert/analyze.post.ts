import { defineEventHandler } from 'h3';
import { promises as fs } from 'fs';
import * as path from 'path';
import * as os from 'os';
import multer from 'multer';
import { BankConverterExcelConfig } from '../../constants/bankConverterExcelConfig';
import { analyzeCommeetWireRowsForPayeeMaster } from '../../services/BankWirePayeeAnalysisService';
import { ErrorHandler } from '../../utils/errorHandler';
import { apiLogger } from '../../services/LoggerService';
import {
  extractCommeetWireExportRows,
  readCommeetSheetMatrix,
} from '../../../utils/commeetBankExcelParse';

/**
 * POST /api/bank-convert/analyze
 * 上傳 Commeet 付款資料 Excel，回傳每筆匯款與 Payee_Accounts 比對結果（JSON，不產檔）
 */
export default defineEventHandler(async (event) => {
  let uploadedPath: string | null = null;
  try {
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    const storage = multer.diskStorage({
      destination: async (_req, _file, cb) => {
        const tempPath = path.join(os.tmpdir(), 'saintdong-uploads');
        try {
          await fs.access(tempPath);
        } catch {
          await fs.mkdir(tempPath, { recursive: true });
        }
        cb(null, tempPath);
      },
      filename: (_req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname}`);
      },
    });

    const upload = multer({
      storage,
      fileFilter: (_req, file, cb) => {
        const ext = file.originalname
          .toLowerCase()
          .substring(file.originalname.lastIndexOf('.'));
        if (['.xlsx', '.xls'].includes(ext)) {
          cb(null, true);
        } else {
          cb(
            new Error('只允許上傳付款資料 Excel 檔案（.xlsx、.xls）'),
            false
          );
        }
      },
    });

    const uploadedFile = await new Promise<Express.Multer.File>(
      (resolve, reject) => {
        upload.single('file')(
          event.node.req as any,
          event.node.res as any,
          (err: any) => {
            if (err) reject(err);
            else if (!(event.node.req as any).file) {
              reject(new Error('NO_FILE'));
            } else resolve((event.node.req as any).file);
          }
        );
      }
    );

    uploadedPath = uploadedFile.path;
    const inputBuffer = await fs.readFile(uploadedFile.path);
    if (inputBuffer.length === 0) {
      throw new Error('上傳的檔案是空檔案');
    }

    const cfg = BankConverterExcelConfig;
    const sheet = readCommeetSheetMatrix(inputBuffer, cfg);
    if (!sheet.ok) {
      throw new Error(sheet.error);
    }

    const extracted = extractCommeetWireExportRows(sheet.jsonData, cfg);
    if (!extracted.ok) {
      throw new Error(extracted.error);
    }

    apiLogger.info('網銀轉檔分析', {
      filename: uploadedFile.originalname,
      wireRows: extracted.rows.length,
    });

    const rows =
      extracted.rows.length === 0
        ? []
        : await analyzeCommeetWireRowsForPayeeMaster(extracted.rows);

    await fs.unlink(uploadedFile.path).catch(() => {});

    return {
      ok: true,
      sourceFilename: uploadedFile.originalname,
      sheetName: sheet.sheetName,
      skippedNonWire: extracted.skippedNonWire,
      skippedInvalid: extracted.skippedInvalid,
      totalDataRows: extracted.totalDataRows,
      wireRowCount: extracted.rows.length,
      rows,
    };
  } catch (e: any) {
    if (uploadedPath) {
      await fs.unlink(uploadedPath).catch(() => {});
    }
    apiLogger.error('網銀轉檔分析失敗', e);
    ErrorHandler.handleUploadError(e);
  }
});
