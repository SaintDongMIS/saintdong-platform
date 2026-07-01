/**
 * B 桶 — 對 COMMEET 既有供應商補齊台幣匯款帳號
 * - 無帳號 → addTwSupplierAccount
 * - 有帳號但不完整（缺 branch、前導零、戶名簡稱）→ updateTwSupplierAccount（以 DB 為準）
 *
 * 用法：
 *   node scripts/commeet-reconcile/add-b-via-api.mjs --limit 2
 *   node scripts/commeet-reconcile/add-b-via-api.mjs --offset 2 --limit 10
 *   node scripts/commeet-reconcile/add-b-via-api.mjs --payee-ids 2,10
 *   node scripts/commeet-reconcile/add-b-via-api.mjs --dry-run --limit 5
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = import.meta.dirname;
const dotenv = require('dotenv');
const puppeteer = require('puppeteer-core');

dotenv.config({ path: path.join(ROOT, '.env') });

const SELECTORS = {
  emailInput: 'div:nth-of-type(2) > div:nth-of-type(1) > div > input',
  passwordInput: 'div:nth-of-type(2) > div:nth-of-type(1) > input',
  loginButton: 'button[data-testid="btn-login"]',
};

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = null;
  let offset = 0;
  let payeeIds = null;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') limit = parseInt(args[++i], 10);
    else if (args[i] === '--offset') offset = parseInt(args[++i], 10);
    else if (args[i] === '--payee-ids') payeeIds = args[++i].split(',').map((s) => s.trim());
    else if (args[i] === '--dry-run') dryRun = true;
  }
  return { limit, offset, payeeIds, dryRun };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normBank(s) {
  return String(s ?? '').replace(/\D/g, '').padStart(3, '0').slice(-3);
}

function normAcct(s) {
  return String(s ?? '').replace(/\D/g, '');
}

function normBranch(s) {
  return String(s ?? '').replace(/\D/g, '');
}

function stripLeadingZeros(s) {
  return String(s ?? '').replace(/^0+/, '') || '0';
}

function acctDigitsMatch(a, b) {
  return stripLeadingZeros(normAcct(a)) === stripLeadingZeros(normAcct(b));
}

function buildPlanned(row, existingAcct, isDefault) {
  return {
    supplier_id: row.commeet_supplier_id,
    account_id: existingAcct?.id,
    account_name: row.name,
    bank_code: normBank(row.bank_code),
    branch_code: String(row.branch_code ?? '').trim(),
    account_number: String(row.account_no ?? '').trim(),
    is_default: existingAcct?.is_default ?? isDefault,
    purpose: existingAcct?.purpose ?? '',
    remarks: existingAcct?.remarks ?? '',
    bank_name: existingAcct?.bank_name ?? '',
  };
}

function isCompleteMatch(commeetAcct, row) {
  const dbBranch = normBranch(row.branch_code).padStart(4, '0').slice(-4);
  const cmBranch = normBranch(commeetAcct.branch_code).padStart(4, '0').slice(-4);
  return (
    normBank(commeetAcct.bank_code) === normBank(row.bank_code) &&
    dbBranch === cmBranch &&
    normAcct(commeetAcct.account_number) === normAcct(row.account_no) &&
    String(commeetAcct.account_name ?? '').trim() === String(row.name ?? '').trim()
  );
}

function findExistingAction(infos, row) {
  const list = infos ?? [];
  for (const a of list) {
    if (isCompleteMatch(a, row)) {
      return { action: 'skip', account: a, reason: 'bank + branch + account + 戶名已與 DB 一致' };
    }
  }
  for (const a of list) {
    if (normBank(a.bank_code) !== normBank(row.bank_code)) continue;
    if (!acctDigitsMatch(a.account_number, row.account_no)) continue;
    const missingBranch = !normBranch(a.branch_code);
    const wrongBranch =
      normBranch(a.branch_code) &&
      normBranch(a.branch_code).padStart(4, '0').slice(-4) !==
        normBranch(row.branch_code).padStart(4, '0').slice(-4);
    const wrongName = String(a.account_name ?? '').trim() !== String(row.name ?? '').trim();
    const wrongAcct = normAcct(a.account_number) !== normAcct(row.account_no);
    if (missingBranch || wrongBranch || wrongName || wrongAcct) {
      const parts = [];
      if (missingBranch) parts.push('缺 branch_code');
      if (wrongBranch) parts.push('branch 不符');
      if (wrongName) parts.push('戶名不完整');
      if (wrongAcct) parts.push('帳號格式不符');
      return { action: 'update', account: a, reason: `帳號存在但不完整（${parts.join('、')}），以 DB 補齊` };
    }
  }
  return { action: 'add', account: null, reason: 'COMMEET 無此 bank+account，新增' };
}

function loadBBucketRows({ limit, offset, payeeIds }) {
  const raw = fs.readFileSync(path.join(OUT, 'bucket_B.csv'), 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split('\n').filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  let rows = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const o = {};
    headers.forEach((h, i) => {
      o[h] = vals[i] ?? '';
    });
    return o;
  });
  if (payeeIds?.length) {
    rows = rows.filter((r) => payeeIds.includes(String(r.payee_id)));
  } else {
    if (offset) rows = rows.slice(offset);
    if (limit != null) rows = rows.slice(0, limit);
  }
  return rows;
}

function summarizeAccounts(infos) {
  return (infos ?? []).map((a) => ({
    account_name: a.account_name,
    bank_code: a.bank_code,
    branch_code: a.branch_code ?? '',
    account_number: a.account_number,
    is_default: a.is_default,
  }));
}

async function loginAndGetPage() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const loginUrl = (process.env.COMMEET_LOGIN_URL || 'https://bimgroup.commeet.co/ap/login')
    .replace(/^["']+|["']+$/g, '')
    .trim();
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector(SELECTORS.emailInput, { timeout: 15000 });
  await page.type(SELECTORS.emailInput, process.env.COMMEET_EMAIL);
  await page.type(SELECTORS.passwordInput, process.env.COMMEET_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ timeout: 20000 }).catch(() => null),
    page.click(SELECTORS.loginButton),
  ]);
  await page.goto('https://bimgroup.commeet.co/ap/membercenter/supplierInfo', {
    waitUntil: 'domcontentloaded',
  });
  await new Promise((r) => setTimeout(r, 2000));
  return { browser, page };
}

async function getSupplier(page, id) {
  const d = await page.evaluate(async (sid) => {
    const r = await fetch(`/ap/api/supplier/getSupplier/${sid}`);
    return r.json();
  }, id);
  return d.result;
}

async function addAccount(page, payload) {
  return page.evaluate(async (p) => {
    const r = await fetch('/ap/api/supplier/addTwSupplierAccount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    let body;
    try {
      body = await r.json();
    } catch {
      body = { raw: await r.text() };
    }
    return { status: r.status, body };
  }, payload);
}

async function updateAccount(page, payload) {
  return page.evaluate(async (p) => {
    const r = await fetch('/ap/api/supplier/updateTwSupplierAccount', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    let body;
    try {
      body = await r.json();
    } catch {
      body = { raw: await r.text() };
    }
    return { status: r.status, body };
  }, payload);
}

async function processRow(page, row, dryRun) {
  const supplierId = row.commeet_supplier_id;
  const before = await getSupplier(page, supplierId);
  if (!before) {
    return { payee_id: row.payee_id, name: row.name, ok: false, action: 'error', reason: 'getSupplier 失敗' };
  }

  const beforeAccounts = summarizeAccounts(before.tw_account_transfer_infos);
  const decision = findExistingAction(before.tw_account_transfer_infos, row);
  const planned = buildPlanned(row, decision.account, beforeAccounts.length === 0);

  if (decision.action === 'skip') {
    return {
      payee_id: row.payee_id,
      name: row.name,
      commeet_supplier_code: before.supplier_code,
      ok: true,
      action: 'skipped',
      reason: decision.reason,
      before_accounts: beforeAccounts,
      planned,
      after_accounts: beforeAccounts,
    };
  }

  if (dryRun) {
    return {
      payee_id: row.payee_id,
      name: row.name,
      commeet_supplier_code: before.supplier_code,
      ok: true,
      action: decision.action === 'update' ? 'dry_run_update' : 'dry_run_add',
      reason: decision.reason,
      before_accounts: beforeAccounts,
      planned,
    };
  }

  const res =
    decision.action === 'update'
      ? await updateAccount(page, planned)
      : await addAccount(page, planned);
  const after = await getSupplier(page, supplierId);
  const afterAccounts = summarizeAccounts(after?.tw_account_transfer_infos);
  const ok = res.status === 200 && !!res.body?.result?.id;

  return {
    payee_id: row.payee_id,
    name: row.name,
    commeet_supplier_code: before.supplier_code,
    ok,
    action: ok ? (decision.action === 'update' ? 'updated' : 'added') : 'failed',
    reason: ok ? decision.reason : JSON.stringify(res.body),
    before_accounts: beforeAccounts,
    planned,
    after_accounts: afterAccounts,
    api_status: res.status,
  };
}

async function main() {
  const opts = parseArgs();
  const rows = loadBBucketRows(opts);
  if (!rows.length) {
    console.error('沒有符合條件的 B 桶資料');
    process.exit(1);
  }

  console.log(`B 桶待處理 ${rows.length} 筆${opts.dryRun ? ' [DRY RUN]' : ''}\n`);

  const { browser, page } = await loginAndGetPage();
  console.log('COMMEET 登入成功\n');

  const results = [];
  for (const row of rows) {
    console.log(`--- payee_id=${row.payee_id} ${row.name} (${row.commeet_supplier_code}) ---`);
    console.log(`  DB 帳號: ${row.bank_code}-${row.branch_code}-${row.account_no}`);
    const r = await processRow(page, row, opts.dryRun);
    results.push(r);

    console.log(`  COMMEET 補前: ${r.before_accounts.length ? JSON.stringify(r.before_accounts) : '（無帳號）'}`);
    if (r.action === 'skipped') {
      console.log(`  → 略過：${r.reason}`);
    } else if (r.action === 'dry_run_add' || r.action === 'dry_run_update') {
      console.log(`  → ${r.action === 'dry_run_update' ? '將更新' : '將新增'}: ${JSON.stringify(r.planned)}`);
      console.log(`  原因: ${r.reason}`);
    } else if (r.action === 'added' || r.action === 'updated') {
      console.log(`  → ${r.action === 'updated' ? '已更新' : '已新增'}: ${JSON.stringify(r.planned)}`);
      console.log(`  COMMEET 補後: ${JSON.stringify(r.after_accounts)}`);
    } else {
      console.log(`  → 失敗: ${r.reason}`);
    }
    console.log('');
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(OUT, `add-b-result-${stamp}.json`);
  fs.writeFileSync(logPath, JSON.stringify({ opts, results }, null, 2), 'utf8');

  const added = results.filter((r) => r.action === 'added').length;
  const updated = results.filter((r) => r.action === 'updated').length;
  const skipped = results.filter((r) => r.action === 'skipped').length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`完成：新增 ${added}、更新 ${updated}、略過 ${skipped}、失敗 ${failed}`);
  console.log(`紀錄：${logPath}`);

  await browser.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
