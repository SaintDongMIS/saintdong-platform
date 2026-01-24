import { defineEventHandler } from 'h3';
import { UploadHandler } from '../utils/uploadHandler';
import { processUploadPipelinePreview } from './upload/financeUploadPipelinePreview';

/**
 * jim測試用 - 預覽模式的檔案處理
 * 執行與正常上傳相同的流程，但不寫入資料庫
 * 
 * POST /api/process-excel
 */
export default defineEventHandler(async (event) => {
  return UploadHandler.handleUploadRequest(event, {
    department: '財務部門 (預覽模式 - 不寫入資料庫)',
    processUpload: processUploadPipelinePreview,
  });
});
