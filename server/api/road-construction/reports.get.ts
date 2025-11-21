import { defineEventHandler, getQuery } from 'h3';
import { getConnectionPool } from '~/server/config/database';
import { apiLogger } from '~/server/services/LoggerService';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const {
    page = '1',
    limit = '10',
    dispatchOrderNumber,
    itemName,
    startDate,
    endDate,
  } = query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const offset = (pageNum - 1) * limitNum;

  try {
    const pool = await getConnectionPool();
    const request = pool.request();

    let whereClauses = [];
    if (dispatchOrderNumber) {
      whereClauses.push(`[派工單號] LIKE @dispatchOrderNumber`);
      request.input('dispatchOrderNumber', `%${dispatchOrderNumber}%`);
    }
    if (itemName) {
      whereClauses.push(`[項目名稱] LIKE @itemName`);
      request.input('itemName', `%${itemName}%`);
    }
    if (startDate) {
      whereClauses.push(`[日期] >= @startDate`);
      request.input('startDate', startDate);
    }
    if (endDate) {
      whereClauses.push(`[日期] <= @endDate`);
      request.input('endDate', endDate);
    }

    const whereCondition =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const dataQuery = `
      SELECT *
      FROM RoadConstructionForm
      ${whereCondition}
      ORDER BY [日期] DESC, [RCid] DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;
    request.input('offset', offset);
    request.input('limit', limitNum);

    const summaryQuery = `
      SELECT 
        COUNT(*) as total,
        SUM([數量]) as totalAmount
      FROM RoadConstructionForm
      ${whereCondition};
    `;

    // Execute queries in parallel for better performance
    const [dataResult, summaryResult] = await Promise.all([
      request.query(dataQuery),
      request.query(summaryQuery),
    ]);

    const total = summaryResult.recordset[0].total;
    const totalAmount = summaryResult.recordset[0].totalAmount || 0;

    return {
      data: dataResult.recordset,
      total,
      totalAmount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    apiLogger.error('查詢道路施工部報表失敗', error, {
      query,
    });
    return {
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      error: errorMessage,
    };
  }
});
