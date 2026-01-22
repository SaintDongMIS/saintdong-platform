import { defineEventHandler, getQuery } from 'h3';
import { ConstructionRecordService } from '~/server/services/ConstructionRecordService';

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);

    const options = {
      startDate: query.startDate as string | undefined,
      endDate: query.endDate as string | undefined,
      單位: query.單位 as string | undefined,
      page: query.page ? Number(query.page) : 1,
      limit: query.limit ? Number(query.limit) : 100,
    };

    const result = await ConstructionRecordService.getRecords(options);

    return result;
  } catch (error) {
    console.error('取得施工記錄失敗:', error);
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : '取得施工記錄失敗',
    });
  }
});
