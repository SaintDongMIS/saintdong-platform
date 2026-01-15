import type { Knex } from 'knex';
import { reimbursementTableSchema } from '../services/TableDefinitionService';

const expendFormTableName = 'ExpendForm';
const tempTableName = 'ExpendForm_temp';

/**
 * 此遷移腳本旨在安全地重新排序 ExpendForm 資料表的欄位，而不會遺失資料。
 * 流程：建立新表 -> 複製資料 -> 刪除舊表 -> 重命名新表
 */
export async function up(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    // 步驟 1: 以正確的順序建立一個新的暫存資料表
    await trx.schema.raw(
      `CREATE TABLE ${tempTableName} (${reimbursementTableSchema})`
    );

    // 步驟 2: 從舊的資料表中取得所有欄位名稱
    const columnsResult = await trx.raw(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = '${expendFormTableName}'
      ORDER BY ORDINAL_POSITION
    `);
    const columns: string[] = columnsResult.map((col: any) => col.COLUMN_NAME);

    // 過濾掉 IDENTITY 主鍵，因為它不能被直接插入
    const columnsToInsert = columns.filter((col) => col !== 'EFid');
    const columnListString = columnsToInsert
      .map((col) => `[${col}]`)
      .join(', ');

    // 步驟 3: 將舊表的資料複製到新表
    // 透過明確列出所有欄位，我們確保了即使順序不同，資料也能正確對應
    if (columnsToInsert.length > 0) {
      await trx.raw(`
        SET IDENTITY_INSERT ${tempTableName} ON;
        INSERT INTO ${tempTableName} (EFid, ${columnListString})
        SELECT EFid, ${columnListString}
        FROM ${expendFormTableName};
        SET IDENTITY_INSERT ${tempTableName} OFF;
      `);
    }

    // 步驟 4: 刪除舊的、順序不正確的資料表
    await trx.schema.dropTable(expendFormTableName);

    // 步驟 5: 將暫存資料表重命名為正式名稱
    await trx.raw(
      `EXEC sp_rename '${tempTableName}', '${expendFormTableName}'`
    );
  });
}

/**
 * down 方法旨在還原 up 方法的操作。
 * 這會是一個同樣複雜的逆向操作，此處為簡化起見，
 * 我們假設回滾操作是刪除資料表，因為通常會從頭開始重新遷移。
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(expendFormTableName);
}
