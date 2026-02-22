import { DatabaseService } from '~/server/services/DatabaseService';
import { automationLogger } from '~/server/services/LoggerService';

// 資料表名稱
const TABLE_NAME = 'ExpendForm';

interface ManualUpdateRequestBody {
  efid: number;
  updates: Record<string, any>;
  changedBy: string;
}

/**
 * 手動更新 COMMEET 資料 API（帶變更追蹤）
 *
 * POST /api/commeet/manual-update
 *
 * 功能：
 * - 手動更新指定 EFid 的資料
 * - 自動記錄變更到 ExpendForm_ChangeLog
 * - 支援更新付款狀態、實際付款日期等欄位
 *
 * 使用場景：
 * - 主管要求手動修改某筆資料的付款狀態
 * - 財務人員要修正錯誤的付款日期
 *
 * Request Body:
 * {
 *   "efid": 12345,
 *   "updates": {
 *     "付款狀態": "已付款",
 *     "實際付款日期": "2026-02-03"
 *   },
 *   "changedBy": "ADMIN_吳采頻"
 * }
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ManualUpdateRequestBody>(event);

    // 驗證必要欄位
    if (!body.efid || !body.updates || !body.changedBy) {
      throw createError({
        statusCode: 400,
        message: '缺少必要欄位：efid, updates, changedBy',
      });
    }

    automationLogger.info('開始手動更新資料', {
      efid: body.efid,
      fields: Object.keys(body.updates),
      changedBy: body.changedBy,
    });

    // 步驟 1: 驗證資料庫連接
    const dbConnected = await DatabaseService.testConnection();
    if (!dbConnected) {
      throw new Error('資料庫連接失敗');
    }

    // 步驟 2: 執行更新（帶變更追蹤）
    await DatabaseService.manualUpdateWithTracking(
      TABLE_NAME,
      body.efid,
      body.updates,
      body.changedBy
    );

    automationLogger.info('手動更新成功', {
      efid: body.efid,
      changedBy: body.changedBy,
    });

    return {
      success: true,
      message: '更新成功並已記錄變更',
      data: {
        efid: body.efid,
        updatedFields: Object.keys(body.updates),
        changedBy: body.changedBy,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    automationLogger.error('手動更新失敗', error);

    throw createError({
      statusCode: 500,
      message: `更新失敗: ${errorMessage}`,
    });
  }
});
