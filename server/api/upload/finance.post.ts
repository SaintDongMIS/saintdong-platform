import { defineEventHandler } from 'h3';
import { UploadHandler } from '../../utils/uploadHandler';
import { processUploadPipeline } from './financeUploadPipeline';

/**
 * 財務部檔案上傳 API
 *
 * POST /api/upload/finance
 */
export default defineEventHandler(async (event) => {
  return UploadHandler.handleUploadRequest(event, {
    department: '財務部門',
    processUpload: processUploadPipeline,
  });
});
