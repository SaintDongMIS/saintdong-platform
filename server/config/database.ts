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
    connectionTimeout: 60000, // 60秒連接超時 (遠端連接需要更長時間)
    requestTimeout: 60000, // 60秒請求超時
    validateBulkLoadParameters: false,
    useUTC: false,
  },
  pool: {
    max: 10, // 最大連接數
    min: 0, // 最小連接數
    idleTimeoutMillis: 30000, // 空閒超時
    acquireTimeoutMillis: 60000, // 獲取連接超時
  },
};

// 連接池實例
let pool: sql.ConnectionPool | null = null;

// 取得資料庫連接池
export async function getConnectionPool() {
  if (!pool || !pool.connected) {
    try {
      // 如果舊的連接池存在但未連接，先關閉它
      if (pool && !pool.connected) {
        await pool.close();
        pool = null;
      }

      console.log('🔗 嘗試連接資料庫:', {
        server: dbConfig.server,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
      });

      pool = new sql.ConnectionPool(dbConfig);
      await pool.connect();
      console.log('✅ SQL Server 連接成功');
    } catch (err) {
      const error = err as { code?: string; message: string; errno?: string };
      console.error('❌ SQL Server 連接失敗:', {
        code: error.code,
        errno: error.errno,
        message: error.message,
        server: dbConfig.server,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
      });

      // 根據錯誤類型提供更詳細的錯誤訊息
      let errorMessage = `Database connection failed: ${error.message}`;
      if (error.code === 'ECONNREFUSED' || error.errno === 'ECONNREFUSED') {
        errorMessage = `無法連接到資料庫伺服器 ${dbConfig.server}:${dbConfig.port}。請檢查 VPN 連接和防火牆設定。`;
      } else if (error.code === 'ETIMEDOUT' || error.errno === 'ETIMEDOUT') {
        errorMessage = `資料庫連接超時。請檢查網路連通性和 VPN 狀態。`;
      } else if (error.message.includes('Login failed')) {
        errorMessage = `資料庫登入失敗。請檢查使用者名稱和密碼。`;
      }

      throw new Error(errorMessage);
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
