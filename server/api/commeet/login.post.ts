import { CommeetService } from '~/server/services/CommeetService';

/**
 * COMMEET 自動登入 API
 *
 * POST /api/commeet/login
 *
 * 功能：
 * - 從環境變數讀取憑證（COMMEET_EMAIL, COMMEET_PASSWORD）
 * - 執行自動登入流程
 * - 回傳登入結果
 *
 * 回應格式：
 * {
 *   "success": true,
 *   "message": "登入成功"
 * }
 */
export default defineEventHandler(async (event) => {
  try {
    const service = new CommeetService();
    const result = await service.login();

    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    throw createError({
      statusCode: 500,
      statusMessage: `COMMEET 自動登入失敗: ${errorMessage}`,
    });
  }
});
