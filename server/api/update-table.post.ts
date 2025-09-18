import { defineEventHandler } from 'h3';
import { getConnectionPool } from '../config/database';
import { reimbursementTableSchema } from '../services/TableDefinitionService';

export default defineEventHandler(async (event) => {
  try {
    console.log('🔧 更新費用報銷單資料表結構...');

    const pool = await getConnectionPool();

    // 刪除舊的資料表
    await pool.request().query('DROP TABLE IF EXISTS 費用報銷單');

    // 建立新的費用報銷單資料表，簡化設計
    const createTableQuery = `
      CREATE TABLE 費用報銷單 (
        ${reimbursementTableSchema}
      )
    `;

    await pool.request().query(createTableQuery);

    // 建立索引 - 目前只需要主鍵索引（表單編號）
    // 未來如有查詢需求，可考慮添加以下索引：
    // CREATE INDEX IX_費用報銷單_申請人 ON 費用報銷單([申請人姓名])
    // CREATE INDEX IX_費用報銷單_申請日期 ON 費用報銷單([申請日期])
    // CREATE INDEX IX_費用報銷單_費用歸屬 ON 費用報銷單([費用歸屬])
    // CREATE INDEX IX_費用報銷單_建立時間 ON 費用報銷單([建立時間])

    console.log('✅ 費用報銷單資料表結構更新成功');

    return {
      success: true,
      message: '費用報銷單資料表結構更新成功',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('❌ 更新資料表失敗:', error);

    return {
      success: false,
      message: error.message || '更新資料表失敗',
      timestamp: new Date().toISOString(),
    };
  }
});
