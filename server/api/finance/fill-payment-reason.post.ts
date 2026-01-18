import { defineEventHandler, setHeader } from 'h3';
import { ExcelService } from '../../services/ExcelService';
import { ExcelGeneratorService } from '../../services/ExcelGeneratorService';
import { DatabaseService } from '../../services/DatabaseService';
import { FileUploadHandler } from '../../utils/fileUploadHandler';
import { ErrorHandler } from '../../utils/errorHandler';
import { automationLogger } from '../../services/LoggerService';

export default defineEventHandler(async (event) => {
  let uploadedFile: Express.Multer.File | null = null;

  try {
    if (event.node.req.method !== 'POST') {
      ErrorHandler.methodNotAllowed();
    }

    automationLogger.info('開始處理付款報表事由填補自動化任務');

    // 1. 處理檔案上傳
    uploadedFile = await handleFileUpload(event);
    const filePath = uploadedFile.path;

    // 2. 解析 Payment_...xlsx 檔案
    const paymentData = await ExcelService.parseExcel(filePath);

    // 3. 提取所有需要填補的表單編號
    const formNumbersToFill = paymentData.rows
      .filter((row) => ExcelService.isValueEmpty(row['事由']) && row['表單編號'])
      .map((row) => row['表單編號']);

    if (formNumbersToFill.length === 0) {
      automationLogger.info('所有付款報表事由欄位均已填寫，無需處理。');
      const emptyProcessedExcelBuffer = await ExcelGeneratorService.generateExcelBuffer(paymentData);
      const fileName = ExcelGeneratorService.generateFileName(uploadedFile.originalname);
      setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setHeader(event, 'Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      setHeader(event, 'Content-Length', emptyProcessedExcelBuffer.length);
      await ExcelService.cleanupFile(filePath); // 清理上傳的檔案
      return emptyProcessedExcelBuffer;
    }

    // 4. 從資料庫查詢對應的「請款原因-表單下方選項」
    const reimbursementDetails = await DatabaseService.getReimbursementReasons(formNumbersToFill);

    // 將查詢結果轉換為 Map，方便查找
    const formNumberToReasonMap = new Map<string, string>();
    reimbursementDetails.forEach((detail: any) => {
      formNumberToReasonMap.set(detail['表單編號'], detail['請款原因-表單下方選項']);
    });

    // 5. 填補 Payment_...xlsx 資料中的「事由」欄位
    paymentData.rows.forEach((row) => {
      if (ExcelService.isValueEmpty(row['事由']) && row['表單編號']) {
        const reason = formNumberToReasonMap.get(row['表單編號']);
        if (reason) {
          row['事由'] = reason;
          automationLogger.debug(`已為表單編號 ${row['表單編號']} 填補事由: ${reason}`);
        } else {
          automationLogger.warn(`未找到表單編號 ${row['表單編號']} 的請款原因，事由欄位保持空白。`);
        }
      }
    });

    // 6. 生成新的 Excel 檔案
    const processedExcelBuffer = await ExcelGeneratorService.generateExcelBuffer(paymentData);
    const fileName = ExcelGeneratorService.generateFileName(uploadedFile.originalname);

    // 7. 設定回應標頭並回傳檔案
    setHeader(event, 'Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    setHeader(event, 'Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"` );
    setHeader(event, 'Content-Length', processedExcelBuffer.length);

    automationLogger.info('付款報表事由填補自動化任務完成', {
      originalName: uploadedFile.originalname,
      processedName: fileName,
      fileSize: processedExcelBuffer.length,
    });

    return processedExcelBuffer;
  } catch (error: any) {
    automationLogger.error('付款報表事由填補自動化任務失敗', error);

    if (uploadedFile) {
      await ExcelService.cleanupFile(uploadedFile.path);
    }
    ErrorHandler.handleUploadError(error);
  } finally {
    if (uploadedFile) {
      await ExcelService.cleanupFile(uploadedFile.path); // 確保清理暫存檔案
    }
  }
});

/**
 * 處理檔案上傳
 */
async function handleFileUpload(event: any): Promise<Express.Multer.File> {
  try {
    const file = await FileUploadHandler.handleUpload(
      event.node.req,
      event.node.res
    );
    automationLogger.info('檔案上傳成功', {
      fileName: file.originalname,
      fileSize: file.size,
    });
    return file;
  } catch (error: any) {
    if (error.message === 'NO_FILE') {
      ErrorHandler.noFileSelected();
    }
    throw error;
  }
}

