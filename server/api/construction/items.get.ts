import { defineEventHandler, getQuery } from 'h3';
import { ConstructionItemService } from '~/server/services/ConstructionItemService';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const activeOnly = query.activeOnly === 'true';

    const result = activeOnly
      ? await ConstructionItemService.getActiveItems()
      : await ConstructionItemService.getAllItems();

    return result;
  } catch (error) {
    console.error('取得項目清單失敗:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : '取得項目清單失敗',
    });
  }
});
