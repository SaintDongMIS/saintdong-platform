import { defineEventHandler, getRouterParam } from 'h3';
import { ConstructionRecordService } from '~/server/services/ConstructionRecordService';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少記錄 ID',
      });
    }

    const result = await ConstructionRecordService.getRecordById(Number(id));

    return result;
  } catch (error) {
    console.error('取得施工記錄失敗:', error);

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : '取得施工記錄失敗',
    });
  }
});
