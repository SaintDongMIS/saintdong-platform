import type { Knex } from 'knex';

/**
 * 遷移腳本：最終修正 ExpendForm 資料表欄位順序
 *
 * 目的：確保 [已更新] 欄位位於 [建立時間] 之前。
 * 順序應為：... [會計科目原幣金額], [已更新], [建立時間], [更新時間]
 */

export async function up(knex: Knex): Promise<void> {
  const tableName = 'ExpendForm';
  const tempTableName = 'ExpendForm_Final';

  // 1. 檢查舊表是否存在
  const exists = await knex.schema.hasTable(tableName);
  if (!exists) {
    return;
  }

  // 2. 建立新表（依照正確的順序）
  await knex.schema.createTable(tempTableName, (table) => {
    // 依序定義所有欄位
    table.specificType('EFid', 'INT IDENTITY(1,1) PRIMARY KEY');
    table.specificType('表單種類', 'NVARCHAR(50)');
    table.specificType('表單編號', 'NVARCHAR(50)');
    table.specificType('表單狀態', 'NVARCHAR(50)');
    table.specificType('申請人姓名', 'NVARCHAR(50)');
    table.specificType('申請人信箱', 'NVARCHAR(50)');
    table.specificType('申請人部門', 'NVARCHAR(50)');
    table.date('申請日期');
    table.specificType('費用歸屬', 'NVARCHAR(50)');
    table.specificType('事由', 'NVARCHAR(500)');
    table.specificType('勾稽單號', 'NVARCHAR(50)');
    table.specificType('所屬預算', 'NVARCHAR(50)');
    table.specificType('簽核階段', 'NVARCHAR(50)');
    table.decimal('表單本幣總計', 18, 2);
    table.decimal('代墊本幣總計', 18, 2);
    table.decimal('卡片交易本幣總計', 18, 2);
    table.specificType('請款原因-表單下方選項', 'NVARCHAR(500)');
    table.date('付款期限');
    table.specificType('付款狀態', 'NVARCHAR(50)');
    table.date('實際付款日期');
    table.specificType('供應商/銀行/員工', 'NVARCHAR(50)');
    table.specificType('入帳對象代號', 'NVARCHAR(50)');
    table.specificType('入帳對象', 'NVARCHAR(50)');
    table.specificType('付款對象統編', 'NVARCHAR(50)');
    table.decimal('付款金額', 18, 2);
    table.specificType('付款方式', 'NVARCHAR(50)');
    table.specificType('供應商來源', 'NVARCHAR(50)');
    table.specificType('付款銀行戶名', 'NVARCHAR(50)');
    table.specificType('付款銀行代碼', 'NVARCHAR(50)');
    table.specificType('付款分行代碼', 'NVARCHAR(50)');
    table.specificType('付款銀行名稱', 'NVARCHAR(50)');
    table.specificType('付款對象帳戶號碼', 'NVARCHAR(50)');
    table.specificType('用車供應商', 'NVARCHAR(50)');
    table.specificType('乘車代碼', 'NVARCHAR(50)');
    table.date('用車時間');
    table.specificType('上車地點', 'NVARCHAR(50)');
    table.specificType('下車地點', 'NVARCHAR(50)');
    table.specificType('拜訪對象公司', 'NVARCHAR(50)');
    table.specificType('拜訪對象統編', 'NVARCHAR(50)');
    table.specificType('同行同事', 'NVARCHAR(50)');
    table.specificType('費用項目', 'NVARCHAR(50)');
    table.specificType('代墊/卡片', 'NVARCHAR(50)');
    table.date('交易日期');
    table.specificType('備註', 'NVARCHAR(500)');
    table.specificType('項目原幣幣別', 'NVARCHAR(50)');
    table.decimal('項目原幣金額', 18, 2);
    table.decimal('匯率', 18, 6);
    table.specificType('項目本幣幣別', 'NVARCHAR(50)');
    table.decimal('項目本幣金額', 18, 2);
    table.specificType('報銷狀態', 'NVARCHAR(50)');
    table.specificType('油資出發地', 'NVARCHAR(50)');
    table.specificType('油資目的地', 'NVARCHAR(50)');
    table.specificType('每一段的里程數', 'NVARCHAR(50)');
    table.specificType('總里程數', 'NVARCHAR(50)');
    table.specificType('分攤參與部門', 'NVARCHAR(50)');
    table.decimal('分攤金額', 18, 2);
    table.specificType('備註-費用項目選項', 'NVARCHAR(500)');
    table.specificType('憑證類別', 'NVARCHAR(50)');
    table.specificType('發票號碼', 'NVARCHAR(50)');
    table.date('發票日期');
    table.decimal('稅額', 18, 2);
    table.decimal('發票未稅金額', 18, 2);
    table.decimal('發票含稅金額', 18, 2);
    table.specificType('買方統編', 'NVARCHAR(50)');
    table.specificType('賣方統編', 'NVARCHAR(50)');
    table.specificType('入帳狀態', 'NVARCHAR(50)');
    table.specificType('傳票編號', 'NVARCHAR(50)');
    table.date('傳票日期');
    table.specificType('會計科目代號', 'NVARCHAR(50)');
    table.specificType('會計科目', 'NVARCHAR(50)');
    table.decimal('會計科目原幣金額', 18, 2);

    // 正確的順序：已更新 -> 建立時間 -> 更新時間
    table.specificType('已更新', 'BIT').defaultTo(0);
    table.datetime('建立時間').defaultTo(knex.raw('GETDATE()'));
    table.datetime('更新時間').defaultTo(knex.raw('GETDATE()'));
  });

  // 3. 複製資料
  const columns = [
    'EFid',
    '表單種類',
    '表單編號',
    '表單狀態',
    '申請人姓名',
    '申請人信箱',
    '申請人部門',
    '申請日期',
    '費用歸屬',
    '事由',
    '勾稽單號',
    '所屬預算',
    '簽核階段',
    '表單本幣總計',
    '代墊本幣總計',
    '卡片交易本幣總計',
    '請款原因-表單下方選項',
    '付款期限',
    '付款狀態',
    '實際付款日期',
    '供應商/銀行/員工',
    '入帳對象代號',
    '入帳對象',
    '付款對象統編',
    '付款金額',
    '付款方式',
    '供應商來源',
    '付款銀行戶名',
    '付款銀行代碼',
    '付款分行代碼',
    '付款銀行名稱',
    '付款對象帳戶號碼',
    '用車供應商',
    '乘車代碼',
    '用車時間',
    '上車地點',
    '下車地點',
    '拜訪對象公司',
    '拜訪對象統編',
    '同行同事',
    '費用項目',
    '代墊/卡片',
    '交易日期',
    '備註',
    '項目原幣幣別',
    '項目原幣金額',
    '匯率',
    '項目本幣幣別',
    '項目本幣金額',
    '報銷狀態',
    '油資出發地',
    '油資目的地',
    '每一段的里程數',
    '總里程數',
    '分攤參與部門',
    '分攤金額',
    '備註-費用項目選項',
    '憑證類別',
    '發票號碼',
    '發票日期',
    '稅額',
    '發票未稅金額',
    '發票含稅金額',
    '買方統編',
    '賣方統編',
    '入帳狀態',
    '傳票編號',
    '傳票日期',
    '會計科目代號',
    '會計科目',
    '會計科目原幣金額',
    '建立時間',
    '更新時間',
    '已更新',
  ];

  // 檢查目前資料庫中的欄位，避免因為上一次遷移失敗或其他原因導致欄位缺失
  // 這裡我們直接使用所有的欄位，因為前一次遷移應該已經確保了這些欄位存在（只是順序不對）

  const columnList = columns.map((c) => `[${c}]`).join(', ');

  await knex.raw(`
    SET IDENTITY_INSERT ${tempTableName} ON;
    INSERT INTO ${tempTableName} (${columnList})
    SELECT ${columnList} FROM ${tableName};
    SET IDENTITY_INSERT ${tempTableName} OFF;
  `);

  // 4. 刪除舊表
  await knex.schema.dropTable(tableName);

  // 5. 重新命名新表
  await knex.schema.renameTable(tempTableName, tableName);
}

export async function down(knex: Knex): Promise<void> {
  console.log('此遷移不支援自動回滾，請手動調整');
}
