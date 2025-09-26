import { defineEventHandler } from 'h3';
import { getConnectionPool } from '../config/database';
import { reimbursementTableSchema } from '../services/TableDefinitionService';
import { apiLogger } from '../services/LoggerService';

export default defineEventHandler(async (event) => {
  try {
    apiLogger.info('建立 ExpendForm 資料表');

    const pool = await getConnectionPool();

    // 建立 ExpendForm 資料表
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ExpendForm' AND xtype='U')
      CREATE TABLE ExpendForm (
        ${reimbursementTableSchema}
      )
    `;

    await pool.request().query(createTableQuery);

    // 索引已由 PRIMARY KEY 自動建立，此處無需額外建立

    apiLogger.info('ExpendForm 資料表建立成功');

    return {
      success: true,
      message: 'ExpendForm 資料表建立成功',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    apiLogger.error('建立資料表失敗', error);

    return {
      success: false,
      message: error.message || '建立資料表失敗',
      timestamp: new Date().toISOString(),
    };
  }
});
