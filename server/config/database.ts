import sql from 'mssql';
//TODO : todo gcp vpn連進DB
// SQL Server 連接配置
const dbConfig = {
  server: process.env.DB_SERVER || '192.168.8.239',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'dsc@23265946',
  database: process.env.DB_DATABASE || 'APIsync',
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
export async function getConnectionPool() {
  if (!pool) {
    try {
      pool = new sql.ConnectionPool(dbConfig);
      await pool.connect();
      console.log('✅ SQL Server 連接成功');
    } catch (err) {
      const error = err as { code?: string; message: string };
      console.error('❌ SQL Server 連接失敗:', {
        code: error.code,
        message: error.message,
        server: dbConfig.server,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
      });
      // 拋出更明確的錯誤，方便 API 層捕捉
      throw new Error(`Database connection failed: ${error.message}`);
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
