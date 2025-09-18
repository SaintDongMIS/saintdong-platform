import sql from 'mssql';

// SQL Server 連接配置
const dbConfig: sql.config = {
  server: '192.168.8.239',
  port: 1433,
  user: 'sa',
  password: 'dsc@23265946',
  database: 'APIsync',
  options: {
    encrypt: false, // 本地網路不需要加密
    trustServerCertificate: true, // 信任伺服器憑證
    enableArithAbort: true,
    connectionTimeout: 30000, // 30秒連接超時
    requestTimeout: 30000, // 30秒請求超時
  },
  pool: {
    max: 10, // 最大連接數
    min: 0, // 最小連接數
    idleTimeoutMillis: 30000, // 空閒超時
  },
};

// 連接池實例
let pool: sql.ConnectionPool | null = null;

// 取得資料庫連接池
export async function getConnectionPool(): Promise<sql.ConnectionPool> {
  if (!pool) {
    try {
      pool = new sql.ConnectionPool(dbConfig);
      await pool.connect();
      console.log('✅ SQL Server 連接成功');
    } catch (error) {
      console.error('❌ SQL Server 連接失敗:', error);
      throw error;
    }
  }
  return pool;
}

// 關閉連接池
export async function closeConnectionPool(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('🔒 SQL Server 連接已關閉');
  }
}

// 測試資料庫連接
export async function testConnection(): Promise<boolean> {
  try {
    const pool = await getConnectionPool();
    const result = await pool.request().query('SELECT 1 as test');
    console.log('✅ 資料庫連接測試成功:', result.recordset);
    return true;
  } catch (error) {
    console.error('❌ 資料庫連接測試失敗:', error);
    return false;
  }
}

export default dbConfig;
