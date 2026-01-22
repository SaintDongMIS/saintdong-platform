import { defineEventHandler, readBody } from 'h3';
import { ConstructionRecordService } from '~/server/services/ConstructionRecordService';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // 驗證必要欄位
    if (!body.單位 || !body.日期) {
      throw createError({
        statusCode: 400,
        statusMessage: '單位和日期為必填欄位',
      });
    }

    const result = await ConstructionRecordService.createRecord(body);

    return result;
  } catch (error) {
    console.error('新增施工記錄失敗:', error);
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : '新增施工記錄失敗',
    });
  }
});
