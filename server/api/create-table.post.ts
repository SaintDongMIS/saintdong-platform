import { defineEventHandler } from 'h3';
import { getConnectionPool } from '../config/database';
import { reimbursementTableSchema } from '../services/TableDefinitionService';

export default defineEventHandler(async (event) => {
  try {
    console.log('🔧 建立費用報銷單資料表...');

    const pool = await getConnectionPool();

    // 建立費用報銷單資料表
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='費用報銷單' AND xtype='U')
      CREATE TABLE 費用報銷單 (
        ${reimbursementTableSchema}
      )
    `;

    await pool.request().query(createTableQuery);

    // 索引已由 PRIMARY KEY 自動建立，此處無需額外建立

    console.log('✅ 費用報銷單資料表建立成功');

    return {
      success: true,
      message: '費用報銷單資料表建立成功',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('❌ 建立資料表失敗:', error);

    return {
      success: false,
      message: error.message || '建立資料表失敗',
      timestamp: new Date().toISOString(),
    };
  }
});
