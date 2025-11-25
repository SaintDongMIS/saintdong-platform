import { getConnectionPool } from '../../config/database';
import sql from 'mssql';

// 簡單的輸入過濾：只保留中文、英文、數字和空白
const sanitizeInput = (input: any) => {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
};

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const { page: rawPage = 1, pageSize: rawPageSize = 10, ...filters } = query;

    const page = Number(rawPage);
    const pageSize = Number(rawPageSize);

    const pool = await getConnectionPool();
    const request = pool.request();

    // 建立 WHERE 條件
    const whereConditions = [];

    if (filters.表單編號) {
      whereConditions.push('[表單編號] LIKE @表單編號');
      request.input('表單編號', sql.NVarChar, `%${filters.表單編號}%`);
    }

    if (filters.表單狀態) {
      whereConditions.push('[表單狀態] = @表單狀態');
      request.input('表單狀態', sql.NVarChar, filters.表單狀態);
    }

    if (filters.申請人) {
      whereConditions.push('[申請人姓名] LIKE @申請人');
      request.input('申請人', sql.NVarChar, `%${filters.申請人}%`);
    }

    if (filters.申請日期) {
      whereConditions.push('[申請日期] = @申請日期');
      request.input('申請日期', sql.Date, filters.申請日期);
    }

    if (filters.請款原因) {
      const sanitizedReason = sanitizeInput(filters.請款原因);
      if (sanitizedReason) {
        whereConditions.push('[請款原因-表單下方選項] LIKE @請款原因');
        request.input('請款原因', sql.NVarChar, `%${sanitizedReason}%`);
      }
    }

    if (filters.事由) {
      const sanitizedDescription = sanitizeInput(filters.事由);
      if (sanitizedDescription) {
        whereConditions.push('[事由] LIKE @事由');
        request.input('事由', sql.NVarChar, `%${sanitizedDescription}%`);
      }
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    // 計算總數和總金額
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        SUM([表單本幣總計]) as totalAmount
      FROM ExpendForm 
      ${whereClause}
    `;

    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0].total || 0;
    const totalAmount = countResult.recordset[0].totalAmount || 0;

    // 取得分頁資料
    const offset = (page - 1) * pageSize;
    const dataQuery = `
      SELECT *
      FROM ExpendForm
      ${whereClause}
      ORDER BY [申請日期] DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${pageSize} ROWS ONLY
    `;

    const dataResult = await request.query(dataQuery);

    return {
      success: true,
      data: dataResult.recordset,
      total,
      totalAmount,
      page,
      pageSize,
    };
  } catch (error) {
    console.error('取得報表列表失敗:', error);
    throw createError({
      statusCode: 500,
      statusMessage: '取得報表列表失敗',
    });
  }
});
