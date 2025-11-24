import { defineEventHandler } from 'h3';
import { UploadHandler } from '../../utils/uploadHandler';
import { UploadProcessor } from '../../utils/uploadProcessor';
import { RoadConstructionDepartmentConfig } from '../../config/departmentConfig';
import { uploadLogger } from '../../services/LoggerService';

/**
 * 道路施工部檔案上傳 API
 *
 * POST /api/upload/road-construction
 */
export default defineEventHandler(async (event) => {
  return UploadHandler.handleUploadRequest(event, {
    department: '道路施工部門',
    processUpload: async (file: Express.Multer.File) => {
      uploadLogger.info('道路施工部檔案上傳成功', {
        fileName: file.originalname,
        fileSize: file.size,
      });

      return UploadProcessor.processUpload(
        file,
        RoadConstructionDepartmentConfig
      );
    },
  });
});
