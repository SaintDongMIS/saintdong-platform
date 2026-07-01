/**
 * 將 COMMEET 中已匯入的個人戶名供應商設為「不啟用」
 *
 * 用法：
 *   node scripts/commeet-reconcile/disable-personal-suppliers.mjs --keyword 楊博森
 *   node scripts/commeet-reconcile/disable-personal-suppliers.mjs --codes SD006,SD017
 *   node scripts/commeet-reconcile/disable-personal-suppliers.mjs --imported-before SD354
 *   node scripts/commeet-reconcile/disable-personal-suppliers.mjs --codes SD006,SD017 --enable
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
  let keyword = null;
  let codes = null;
  let importedBefore = null;
  let dryRun = false;
  let enable = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keyword') keyword = args[++i];
    else if (args[i] === '--codes') codes = args[++i].split(',').map((s) => s.trim());
    else if (args[i] === '--imported-before') importedBefore = args[++i];
    else if (args[i] === '--dry-run') dryRun = true;
    else if (args[i] === '--enable') enable = true;
  }
  return { keyword, codes, importedBefore, dryRun, enable };
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

function isLikelyPersonal(name) {
  const n = String(name ?? '').trim();
  if (/公司|股份|有限|行$|所$|社$|會$|基金|醫院|銀行|法院|管委會|事務所|合作社|商號|工作室/.test(n)) {
    return false;
  }
  return /^[\u4e00-\u9fff]{2,4}$/.test(n);
}

function loadPersonalCodesBefore(maxCode) {
  const maxNum = parseInt(String(maxCode).replace(/^SD/i, ''), 10);
  const raw = fs.readFileSync(path.join(OUT, 'bucket_C.csv'), 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split('\n').filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const codeIdx = headers.indexOf('proposed_supplier_code');
  const nameIdx = headers.indexOf('name');
  const out = [];
  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line);
    const code = vals[codeIdx];
    const name = vals[nameIdx];
    const num = parseInt(String(code).replace(/^SD/i, ''), 10);
    if (!code || Number.isNaN(num) || num > maxNum) continue;
    if (isLikelyPersonal(name)) out.push({ code, name });
  }
  return out;
}

function buildUpdateBody(sup, isEnable) {
  const pm = sup.supplier_payment_methods.map((m) => ({
    id: m.supplier_payment_method_id,
    payment_method_type: m.payment_method_type,
    payment_name: m.payment_name,
  }));
  return {
    id: sup.id,
    abbreviation: sup.abbreviation,
    full_name: sup.full_name,
    supplier_code: sup.supplier_code,
    supplier_type_id: sup.supplier_type_info?.supplier_type_id,
    supplier_number_type: sup.supplier_number_info?.supplier_number_type ?? 0,
    supplier_number: sup.supplier_number_info?.supplier_number ?? '',
    supplier_payment_methods: pm,
    payment_terms: sup.payment_terms,
    transaction_currency: sup.transaction_currency,
    is_supplier_charge: sup.is_supplier_charge,
    is_enable: isEnable,
    tw_account_transfer_infos: sup.tw_account_transfer_infos,
  };
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

async function findByKeyword(page, keyword) {
  const j = await page.evaluate(async (kw) => {
    const r = await fetch(`/ap/api/supplier/getSupplierList?keyword=${encodeURIComponent(kw)}&limit=50`);
    return r.json();
  }, keyword);
  return j.result?.data ?? [];
}

async function findByCode(page, code) {
  const j = await page.evaluate(async (c) => {
    const r = await fetch(`/ap/api/supplier/getSupplierList?keyword=${encodeURIComponent(c)}&limit=10`);
    return r.json();
  }, code);
  return j.result?.data?.find((x) => x.supplier_code === code) ?? null;
}

async function getSupplier(page, id) {
  const d = await page.evaluate(async (sid) => {
    const r = await fetch(`/ap/api/supplier/getSupplier/${sid}`);
    return r.json();
  }, id);
  return d.result;
}

async function setSupplierEnable(page, item, dryRun, enable) {
  const sup = await getSupplier(page, item.id);
  if (!sup) return { code: item.supplier_code, ok: false, reason: 'getSupplier 失敗' };
  const want = enable;
  if (sup.is_enable === want) {
    return {
      code: item.supplier_code,
      name: sup.full_name,
      abbrev: sup.abbreviation,
      ok: true,
      skipped: true,
      reason: want ? '已是啟用' : '已是停用',
    };
  }
  if (dryRun) {
    return {
      code: item.supplier_code,
      name: sup.full_name,
      abbrev: sup.abbreviation,
      ok: true,
      dryRun: true,
      enable: want,
    };
  }
  const body = buildUpdateBody(sup, want);
  const res = await page.evaluate(async (p) => {
    const r = await fetch('/ap/api/supplier/updateSupplier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    return { status: r.status, body: await r.text() };
  }, body);
  const after = await getSupplier(page, item.id);
  return {
    code: item.supplier_code,
    name: sup.full_name,
    abbrev: sup.abbreviation,
    ok: res.status === 200 && after?.is_enable === want,
    is_enable: after?.is_enable,
    status: res.status,
  };
}

async function main() {
  const opts = parseArgs();
  const { browser, page } = await loginAndGetPage();
  console.log('COMMEET 登入成功\n');

  let targets = [];
  if (opts.keyword) {
    const items = await findByKeyword(page, opts.keyword);
    targets = items.filter((x) => x.full_name === opts.keyword || x.abbreviation?.startsWith(opts.keyword));
    console.log(`關鍵字「${opts.keyword}」找到 ${targets.length} 筆`);
  } else if (opts.codes?.length) {
    for (const code of opts.codes) {
      const item = await findByCode(page, code);
      if (item) targets.push(item);
      else console.log(`⚠ ${code} 不在 COMMEET`);
    }
  } else if (opts.importedBefore) {
    const personal = loadPersonalCodesBefore(opts.importedBefore);
    console.log(`SD001~${opts.importedBefore} 個人戶名 ${personal.length} 筆`);
    for (const { code, name } of personal) {
      const item = await findByCode(page, code);
      if (item) targets.push(item);
      else console.log(`  - ${code} ${name} → 不在 COMMEET，略過`);
    }
  } else {
    console.error('請指定 --keyword、--codes 或 --imported-before');
    process.exit(1);
  }

  if (opts.dryRun) console.log('\n[DRY RUN 模式，不會實際更新]\n');
  const verb = opts.enable ? '啟用' : '停用';

  const results = [];
  for (const item of targets) {
    const r = await setSupplierEnable(page, item, opts.dryRun, opts.enable);
    results.push(r);
    const mark = r.skipped ? r.reason : r.dryRun ? `將${verb}` : r.ok ? `已${verb}` : '失敗';
    console.log(`${r.code} ${r.abbrev || ''} ${r.name || ''} → ${mark}`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = path.join(OUT, `supplier-enable-${stamp}.json`);
  fs.writeFileSync(logPath, JSON.stringify({ opts, results }, null, 2), 'utf8');

  const changed = results.filter((r) => r.ok && !r.skipped && !r.dryRun).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n完成：${verb} ${changed}、略過 ${skipped}、失敗 ${failed}`);
  console.log(`紀錄：${logPath}`);

  await browser.close();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
