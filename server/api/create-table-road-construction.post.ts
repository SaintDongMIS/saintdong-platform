import { defineEventHandler } from 'h3';
import { getConnectionPool } from '../config/database';
import { roadConstructionTableSchema } from '../services/TableDefinitionService';
import { apiLogger } from '../services/LoggerService';

/**
 * 建立道路施工部資料表 API
 *
 * 此 API 專門用於建立 RoadConstructionForm 資料表
 * 重用 create-table.post.ts 的邏輯結構，但保持與財務部完全分離
 */
export default defineEventHandler(async (event) => {
  try {
    apiLogger.info('建立 RoadConstructionForm 資料表');

    // 1. 先測試資料庫連接
    apiLogger.info('測試資料庫連接');
    const { DatabaseService } = await import('../services/DatabaseService');
    const dbConnected = await DatabaseService.testConnection();
    if (!dbConnected) {
      throw new Error('資料庫連接失敗，無法建立資料表');
    }
    apiLogger.info('資料庫連接正常');

    const pool = await getConnectionPool();

    // 建立 RoadConstructionForm 資料表
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='RoadConstructionForm' AND xtype='U')
      CREATE TABLE RoadConstructionForm (
        ${roadConstructionTableSchema}
      )
    `;

    await pool.request().query(createTableQuery);

    // 索引已由 PRIMARY KEY 和 UNIQUE CONSTRAINT 自動建立，此處無需額外建立
    apiLogger.info('RoadConstructionForm 資料表建立成功');

    return {
      success: true,
      message: 'RoadConstructionForm 資料表建立成功',
      tableName: 'RoadConstructionForm',
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    apiLogger.error('建立資料表失敗', error);

    return {
      success: false,
      message: error.message || '建立資料表失敗',
      tableName: 'RoadConstructionForm',
      timestamp: new Date().toISOString(),
    };
  }
});
