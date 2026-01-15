import 'dotenv/config'; // 載入 .env 檔案中的環境變數
import type { Knex } from 'knex';
import dbConfig from './server/config/database';

// Update with your config settings.
const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'mssql',
    connection: {
      host: dbConfig.server,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
    },
    pool: {
      min: dbConfig.pool.min,
      max: dbConfig.pool.max,
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './server/migrations', // 將遷移檔案統一放在 server 資料夾下
    },
  },

  // production: {
  //   client: 'mssql',
  //   connection: {
  //     host: process.env.DB_SERVER,
  //     port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
  //     user: process.env.DB_USER,
  //     password: process.env.DB_PASSWORD,
  //     database: process.env.DB_DATABASE,
  //   },
  //   pool: {
  //     min: 2,
  //     max: 10,
  //   },
  //   migrations: {
  //     tableName: 'knex_migrations',
  //     directory: './server/migrations',
  //   },
  // },
};

module.exports = config;
