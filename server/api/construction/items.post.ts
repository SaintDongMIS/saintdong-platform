import { defineEventHandler, readBody } from 'h3';
import { ConstructionItemService } from '~/server/services/ConstructionItemService';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);

    // 驗證必要欄位
    if (!body.ItemName || !body.Unit || body.Price === undefined) {
      throw createError({
        statusCode: 400,
        statusMessage: '項目名稱、單位和單價為必填欄位',
      });
    }

    const result = await ConstructionItemService.createItem(body);

    return result;
  } catch (error) {
    console.error('新增項目失敗:', error);

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error;
    }

    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : '新增項目失敗',
    });
  }
});
