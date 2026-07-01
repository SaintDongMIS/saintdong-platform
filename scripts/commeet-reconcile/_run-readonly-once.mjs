/**
 * 一次性對帳腳本（READ-ONLY）
 * - DB: SELECT Payee_Accounts only
 * - COMMEET: login session + GET getSupplierList only
 * - 輸出 CSV 至同目錄（scripts/commeet-reconcile/），不寫入 DB / COMMEET
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = import.meta.dirname;
const dotenv = require('dotenv');
const sql = require('mssql');
const fetchFn = globalThis.fetch ?? require('node-fetch');
const puppeteer = require('puppeteer-core');

dotenv.config({ path: path.join(ROOT, '.env') });

const SELECTORS = {
  emailInput: 'div:nth-of-type(2) > div:nth-of-type(1) > div > input',
  passwordInput: 'div:nth-of-type(2) > div:nth-of-type(1) > input',
  loginButton: 'button[data-testid="btn-login"]',
};

function normAcct(s) {
  return String(s ?? '').replace(/\D/g, '');
}
function normBank(s) {
  return String(s ?? '').replace(/\D/g, '').padStart(3, '0').slice(-3);
}
function abbrev(name) {
  const n = String(name ?? '').trim();
  if (n.length <= 3) return n;
  return n.slice(0, 4);
}
function sdCode(n) {
  return `SD${String(n).padStart(3, '0')}`;
}
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(file, headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  fs.writeFileSync(file, '\uFEFF' + lines.join('\n'), 'utf8');
}

async function loginCommeet() {
  const email = process.env.COMMEET_EMAIL;
  const password = process.env.COMMEET_PASSWORD;
  const loginUrl = (process.env.COMMEET_LOGIN_URL || 'https://bimgroup.commeet.co/ap/login')
    .replace(/^["']+|["']+$/g, '')
    .trim();
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector(SELECTORS.emailInput, { timeout: 15000 });
    await page.type(SELECTORS.emailInput, email);
    await page.type(SELECTORS.passwordInput, password);
    await Promise.all([
      page.waitForNavigation({ timeout: 20000 }).catch(() => null),
      page.click(SELECTORS.loginButton),
    ]);
    await new Promise((r) => setTimeout(r, 2000));
    const cookies = await page.cookies();
    const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    if (!cookies.some((c) => c.name === 'ctsK')) {
      throw new Error('COMMEET 登入未取得 ctsK cookie');
    }
    return cookieStr;
  } finally {
    await browser.close();
  }
}

async function fetchAllSuppliers(cookie) {
  const base = 'https://bimgroup.commeet.co/ap/api/supplier/getSupplierList';
  const all = [];
  let page = 1;
  const limit = 50;
  while (true) {
    const url = `${base}?page=${page}&limit=${limit}&sort_type=2&is_enable=1&keyword=&supplier_type_id=all&supplier_payment_method_id=`;
    const res = await fetchFn(url, {
      headers: { Cookie: cookie, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`getSupplierList HTTP ${res.status}`);
    const json = await res.json();
    const batch = json?.result?.data ?? [];
    all.push(...batch);
    const total = json?.result?.total ?? json?.result?.count;
    if (!batch.length || (total && all.length >= total)) break;
    if (batch.length < limit) break;
    page += 1;
  }
  return all;
}

async function loadPayees() {
  const pool = await sql.connect({
    server: process.env.DB_SERVER,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    options: { encrypt: false, trustServerCertificate: true },
  });
  try {
    const r = await pool.request().query(`
      SELECT id, name, bank_code, branch_code, account_no
      FROM dbo.Payee_Accounts
      ORDER BY id
    `);
    return r.recordset.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? '').trim(),
      bank_code: normBank(row.bank_code),
      branch_code: String(row.branch_code ?? '').trim(),
      account_no: String(row.account_no ?? '').trim(),
      account_norm: normAcct(row.account_no),
      abbrev: abbrev(String(row.name ?? '').trim()),
    }));
  } finally {
    await pool.close();
  }
}

function buildCommeetIndexes(suppliers) {
  const accountIndex = new Map();
  const byFullName = new Map();
  const byAbbrev = new Map();

  for (const s of suppliers) {
    const full = String(s.full_name ?? '').trim();
    const ab = String(s.abbreviation ?? '').trim();
    if (full) byFullName.set(full, s);
    if (ab) byAbbrev.set(ab, s);
    for (const acct of s.tw_account_transfer_infos ?? []) {
      const key = `${normBank(acct.bank_code)}:${normAcct(acct.account_number)}`;
      if (!key.endsWith(':')) {
        const list = accountIndex.get(key) ?? [];
        list.push({ supplier: s, account: acct });
        accountIndex.set(key, list);
      }
    }
  }

  return { accountIndex, byFullName, byAbbrev, suppliers };
}

function classify(payee, idx, sdSeq) {
  const key = `${payee.bank_code}:${payee.account_norm}`;
  const acctHits = idx.accountIndex.get(key) ?? [];

  if (acctHits.length === 1) {
    const s = acctHits[0].supplier;
    return {
      bucket: 'A',
      reason: '帳號+銀行代碼已在 COMMEET',
      commeet_supplier_id: s.id,
      commeet_abbreviation: s.abbreviation,
      commeet_full_name: s.full_name,
      commeet_supplier_code: s.supplier_code,
      proposed_supplier_code: '',
      proposed_abbrev: payee.abbrev,
    };
  }
  if (acctHits.length > 1) {
    return {
      bucket: 'D',
      reason: '帳號命中多個 COMMEET 供應商',
      commeet_supplier_id: acctHits.map((h) => h.supplier.id).join('|'),
      commeet_abbreviation: acctHits.map((h) => h.supplier.abbreviation).join('|'),
      commeet_full_name: acctHits.map((h) => h.supplier.full_name).join('|'),
      commeet_supplier_code: '',
      proposed_supplier_code: '',
      proposed_abbrev: payee.abbrev,
    };
  }

  const exactFull = idx.byFullName.get(payee.name);
  if (exactFull) {
    return {
      bucket: 'B',
      reason: '全名完全一致，但 COMMEET 無此帳號',
      commeet_supplier_id: exactFull.id,
      commeet_abbreviation: exactFull.abbreviation,
      commeet_full_name: exactFull.full_name,
      commeet_supplier_code: exactFull.supplier_code,
      proposed_supplier_code: '',
      proposed_abbrev: payee.abbrev,
    };
  }

  const exactAb = idx.byAbbrev.get(payee.abbrev);
  if (exactAb) {
    return {
      bucket: 'B',
      reason: '簡稱一致，但 COMMEET 無此帳號',
      commeet_supplier_id: exactAb.id,
      commeet_abbreviation: exactAb.abbreviation,
      commeet_full_name: exactAb.full_name,
      commeet_supplier_code: exactAb.supplier_code,
      proposed_supplier_code: '',
      proposed_abbrev: payee.abbrev,
    };
  }

  // 僅全名/簡稱完全一致才算 B；模糊比對不再進 D（易誤判為別家），一律當 C 新建
  return {
    bucket: 'C',
    reason: 'COMMEET 無精確匹配，建議新建',
    commeet_supplier_id: '',
    commeet_abbreviation: '',
    commeet_full_name: '',
    commeet_supplier_code: '',
    proposed_supplier_code: sdCode(sdSeq),
    proposed_abbrev: payee.abbrev,
  };
}

async function main() {
  console.log('[READ-ONLY] 開始對帳 — 僅 SELECT / GET，不寫入 DB 或 COMMEET');
  const payees = await loadPayees();
  console.log(`DB Payee_Accounts: ${payees.length} 筆`);

  const cookie = await loginCommeet();
  console.log('COMMEET 登入成功（僅建立 session）');

  const suppliers = await fetchAllSuppliers(cookie);
  console.log(`COMMEET 供應商: ${suppliers.length} 筆`);

  const idx = buildCommeetIndexes(suppliers);
  let sdSeq = 1;
  const results = payees.map((p) => {
    const c = classify(p, idx, sdSeq);
    if (c.bucket === 'C') {
      c.proposed_supplier_code = sdCode(sdSeq);
      sdSeq += 1;
    }
    return {
      payee_id: p.id,
      name: p.name,
      abbrev: p.abbrev,
      bank_code: p.bank_code,
      branch_code: p.branch_code,
      account_no: p.account_no,
      bucket: c.bucket,
      reason: c.reason,
      proposed_supplier_code: c.proposed_supplier_code,
      proposed_abbrev: c.proposed_abbrev,
      commeet_supplier_id: c.commeet_supplier_id,
      commeet_abbreviation: c.commeet_abbreviation,
      commeet_full_name: c.commeet_full_name,
      commeet_supplier_code: c.commeet_supplier_code,
      fuse_score: c.fuse_score ?? '',
    };
  });

  const headers = Object.keys(results[0]);
  const byBucket = { A: [], B: [], C: [], D: [] };
  for (const r of results) byBucket[r.bucket].push(r);

  for (const [b, rows] of Object.entries(byBucket)) {
    writeCsv(path.join(OUT, `bucket_${b}.csv`), headers, rows);
  }
  writeCsv(path.join(OUT, 'all_results.csv'), headers, results);

  const summary = {
    mode: 'READ_ONLY',
    rules_version: 'v2_no_fuzzy_D',
    note: 'D 僅保留帳號命中多家；原模糊相似 169 筆併入 C',
    db_payee_count: payees.length,
    commeet_supplier_count: suppliers.length,
    buckets: {
      A_skip: byBucket.A.length,
      B_add_account: byBucket.B.length,
      C_new_import: byBucket.C.length,
      D_manual_review: byBucket.D.length,
    },
    generated_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n=== 對帳結果 ===');
  console.log(JSON.stringify(summary.buckets, null, 2));
  console.log(`\n報告目錄: ${OUT}`);
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
