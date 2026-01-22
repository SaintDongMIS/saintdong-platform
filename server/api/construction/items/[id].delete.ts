import { defineEventHandler, getRouterParam } from 'h3';
import { ConstructionItemService } from '~/server/services/ConstructionItemService';

export default defineEventHandler(async (event) => {
  try {
    const id = getRouterParam(event, 'id');

    if (!id) {
      throw createError({
        statusCode: 400,
        statusMessage: '缺少項目 ID',
      });
    }

    const result = await ConstructionItemService.deleteItem(Number(id));

    return result;
  } catch (error) {
    console.error('刪除項目失敗:', error);

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : '刪除項目失敗',
    });
  }
});
