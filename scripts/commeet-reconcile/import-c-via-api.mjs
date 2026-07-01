/**
 * C 桶供應商 — COMMEET 批次匯入（API 自動上傳，無需手動操作 Excel）
 *
 * 用法：
 *   node scripts/commeet-reconcile/import-c-via-api.mjs --limit 50 --offset 4
 *   node scripts/commeet-reconcile/import-c-via-api.mjs --codes SD001,SD002
 *
 * 統編：自動查 twincn，查不到就跳過並 append 至 tax-lookup-missed.csv
 * 個人戶名：預設跳過不匯入，記錄於 skipped-personal.csv（--include-personal 可匯入）
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '../..');
const OUT = import.meta.dirname;

const dotenv = require('dotenv');
const XLSX = require('xlsx');
const FormData = require('form-data');
const puppeteer = require('puppeteer-core');

dotenv.config({ path: path.join(ROOT, '.env') });

const fetchFn = globalThis.fetch;
const SELECTORS = {
  emailInput: 'div:nth-of-type(2) > div:nth-of-type(1) > div > input',
  passwordInput: 'div:nth-of-type(2) > div:nth-of-type(1) > input',
  loginButton: 'button[data-testid="btn-login"]',
};

const PAYMENT_METHODS = '匯款';
const CURRENCY = 'TWD';
const SUPPLIER_CHARGE = '是';
const PAYMENT_TERMS = '月結 30 天';
const DATA_START_ROW = 3;
const TAX_MISSED_CSV = path.join(OUT, 'tax-lookup-missed.csv');
const PERSONAL_SKIPPED_CSV = path.join(OUT, 'skipped-personal.csv');
const TAX_LOOKUP_TIMEOUT_MS = 8000;
const TAX_LOOKUP_DELAY_MS = 250;

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = 4;
  let offset = 0;
  let codes = null;
  let skipTaxLookup = false;
  let skipPersonal = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') limit = parseInt(args[++i], 10);
    else if (args[i] === '--offset') offset = parseInt(args[++i], 10);
    else if (args[i] === '--codes') codes = args[++i].split(',').map((s) => s.trim());
    else if (args[i] === '--skip-tax-lookup') skipTaxLookup = true;
    else if (args[i] === '--skip-personal') skipPersonal = true;
    else if (args[i] === '--include-personal') skipPersonal = false;
  }
  return { limit, offset, codes, skipTaxLookup, skipPersonal };
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

function loadCBucketRows({ limit, offset, codes }) {
  const raw = fs.readFileSync(path.join(OUT, 'bucket_C.csv'), 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split('\n').filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const o = {};
    headers.forEach((h, i) => {
      o[h] = vals[i] ?? '';
    });
    return o;
  });
  if (codes?.length) {
    return rows.filter((r) => codes.includes(r.proposed_supplier_code));
  }
  return rows.slice(offset, offset + limit);
}

function normName(s) {
  return String(s ?? '')
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .toLowerCase();
}

function isLikelyPersonal(name) {
  const n = String(name ?? '').trim();
  if (/公司|股份|有限|行$|所$|社$|會$|基金|醫院|銀行|法院|管委會|事務所|合作社|商號|工作室/.test(n)) {
    return false;
  }
  return /^[\u4e00-\u9fff]{2,4}$/.test(n);
}

function inferSupplierType(name) {
  const n = String(name ?? '');
  if (/會計師事務所|記帳士/.test(n)) return '專業服務(會計)';
  if (/智財|專利|商標|律師|法律事務所|律師事務所/.test(n)) return '專業服務(法律)';
  if (/資訊|科技|軟體|數位|系統|電腦|網路/.test(n)) return '資訊/科技';
  if (/管委會|不動產|建設股份|營造|開發股份|大樓管理/.test(n)) return '房地產/開發';
  if (/工程行|工程有限|工程股份|工程有限公司/.test(n)) return '工程營造';
  if (/保險|銀行|證券|資融|租賃股份/.test(n)) return '金融/保險';
  if (/醫院|醫療|診所|藥局|醫師/.test(n)) return '醫療保健';
  if (/旅行社|飯店|餐飲|旅館/.test(n)) return '餐飲/食品';
  if (/法院|公會|社團法人|財團法人|基金會|大學|學校|專戶/.test(n)) return '政府/公共事業';
  if (/印刷|設計|行銷|廣告|媒體/.test(n)) return '行銷/設計/印刷';
  if (/貿易|商行|批發|零售/.test(n)) return '零售/批發';
  return '未分類供應商';
}

function dedupeAbbrevs(rows, existingUsed = new Set()) {
  const used = new Set(existingUsed);
  return rows.map((row) => {
    const base = row.proposed_abbrev || row.abbrev || row.name.slice(0, 4);
    if (!used.has(base)) {
      used.add(base);
      return { ...row, import_abbrev: base };
    }
    const suffix = String(row.account_no ?? '').slice(-4);
    let candidate = `${base}${suffix}`.slice(0, 20);
    let i = 2;
    while (used.has(candidate)) {
      candidate = `${base}${suffix}${i}`.slice(0, 20);
      i++;
    }
    used.add(candidate);
    return { ...row, import_abbrev: candidate };
  });
}

async function fetchExistingAbbrevs(page) {
  const used = new Set();
  let totalPage = 1;
  for (let pageNum = 1; pageNum <= totalPage; pageNum++) {
    const j = await page.evaluate(async (p) => {
      const r = await fetch(`/ap/api/supplier/getSupplierList?limit=100&page=${p}`);
      return r.json();
    }, pageNum);
    totalPage = j.result?.total_page ?? pageNum;
    const data = j.result?.data ?? [];
    if (!data.length) break;
    for (const s of data) {
      if (s.abbreviation) used.add(s.abbreviation);
    }
  }
  return used;
}

function appendPersonalSkipped(records) {
  if (!records.length) return;
  const headers = ['proposed_supplier_code', 'name', 'bank_code', 'branch_code', 'account_no', 'reason', 'logged_at'];
  const existing = new Set();
  if (fs.existsSync(PERSONAL_SKIPPED_CSV)) {
    const lines = fs.readFileSync(PERSONAL_SKIPPED_CSV, 'utf8').replace(/^\uFEFF/, '').split('\n').slice(1);
    for (const line of lines) {
      const code = parseCsvLine(line)[0];
      if (code) existing.add(code);
    }
  }
  const fresh = records.filter((r) => !existing.has(r.proposed_supplier_code));
  if (!fresh.length) return;
  const lines = fresh.map((r) =>
    [r.proposed_supplier_code, r.name, r.bank_code, r.branch_code, r.account_no, r.reason, r.logged_at]
      .map((v) => {
        const s = String(v ?? '');
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(','),
  );
  if (!fs.existsSync(PERSONAL_SKIPPED_CSV)) {
    fs.writeFileSync(PERSONAL_SKIPPED_CSV, '\uFEFF' + headers.join(',') + '\n' + lines.join('\n') + '\n', 'utf8');
  } else {
    fs.appendFileSync(PERSONAL_SKIPPED_CSV, lines.join('\n') + '\n', 'utf8');
  }
}

function partitionPersonalRows(rows, skipPersonal) {
  if (!skipPersonal) return { toImport: rows, skippedPersonal: [] };
  const toImport = [];
  const skippedPersonal = [];
  const stamp = new Date().toISOString();
  for (const row of rows) {
    if (isLikelyPersonal(row.name)) {
      skippedPersonal.push({
        proposed_supplier_code: row.proposed_supplier_code,
        name: row.name,
        bank_code: row.bank_code,
        branch_code: row.branch_code,
        account_no: row.account_no,
        reason: '個人戶名，略過不匯入 COMMEET',
        logged_at: stamp,
      });
    } else {
      toImport.push(row);
    }
  }
  return { toImport, skippedPersonal };
}

function appendTaxMissed(records) {
  if (!records.length) return;
  const headers = ['proposed_supplier_code', 'name', 'reason', 'logged_at'];
  const existing = new Set();
  if (fs.existsSync(TAX_MISSED_CSV)) {
    const lines = fs.readFileSync(TAX_MISSED_CSV, 'utf8').replace(/^\uFEFF/, '').split('\n').slice(1);
    for (const line of lines) {
      const code = parseCsvLine(line)[0];
      if (code) existing.add(code);
    }
  }
  const fresh = records.filter((r) => !existing.has(r.proposed_supplier_code));
  if (!fresh.length) return;
  const lines = fresh.map((r) =>
    [r.proposed_supplier_code, r.name, r.reason, r.logged_at]
      .map((v) => {
        const s = String(v ?? '');
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(','),
  );
  if (!fs.existsSync(TAX_MISSED_CSV)) {
    fs.writeFileSync(TAX_MISSED_CSV, '\uFEFF' + headers.join(',') + '\n' + lines.join('\n') + '\n', 'utf8');
  } else {
    fs.appendFileSync(TAX_MISSED_CSV, lines.join('\n') + '\n', 'utf8');
  }
}

async function lookupTaxId(name) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TAX_LOOKUP_TIMEOUT_MS);
  try {
    const url = `https://a.twincn.com/Lm.aspx?q=${encodeURIComponent(name)}`;
    const res = await fetchFn(url, { signal: controller.signal });
    const html = await res.text();
    if (/共有\s*0\s*筆資料/.test(html)) {
      return { taxId: null, reason: '公開稅籍查無資料' };
    }
    const re = /item\.aspx\?no=(\d{8})[^>]*title="([^"]+)"/g;
    const hits = [];
    let m;
    while ((m = re.exec(html))) {
      hits.push({ taxId: m[1], title: m[2] });
    }
    if (!hits.length) {
      return { taxId: null, reason: '查詢頁無法解析結果' };
    }
    const target = normName(name);
    const exact = hits.filter((h) => normName(h.title) === target);
    if (exact.length === 1) {
      return { taxId: exact[0].taxId, reason: null, matchedName: exact[0].title };
    }
    if (hits.length === 1) {
      return { taxId: hits[0].taxId, reason: null, matchedName: hits[0].title, note: '唯一模糊匹配' };
    }
    return {
      taxId: null,
      reason: `多筆候選(${hits.length})，需人工確認`,
      candidates: hits.slice(0, 5),
    };
  } catch (e) {
    return { taxId: null, reason: e.name === 'AbortError' ? '查詢逾時' : `查詢失敗: ${e.message}` };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function enrichRows(rows, { skipTaxLookup }) {
  const enriched = [];
  const missed = [];
  const stamp = new Date().toISOString();

  for (const row of rows) {
    const supplierType = inferSupplierType(row.name);
    let taxId = null;
    let taxLookup = null;

    if (!skipTaxLookup) {
      if (isLikelyPersonal(row.name)) {
        taxLookup = { taxId: null, reason: '個人戶名，略過自動查詢' };
      } else {
        taxLookup = await lookupTaxId(row.name);
        taxId = taxLookup.taxId;
        await sleep(TAX_LOOKUP_DELAY_MS);
      }
      if (!taxId) {
        missed.push({
          proposed_supplier_code: row.proposed_supplier_code,
          name: row.name,
          reason: taxLookup?.reason ?? '未知',
          logged_at: stamp,
        });
      }
    }

    enriched.push({
      ...row,
      supplier_type: supplierType,
      tax_id: taxId,
      tax_lookup: taxLookup,
    });
  }

  if (missed.length) {
    appendTaxMissed(missed);
    console.log(`\n⚠ 統編查不到 ${missed.length} 筆，已寫入 ${TAX_MISSED_CSV}`);
    for (const m of missed) {
      console.log(`  - ${m.proposed_supplier_code} ${m.name}: ${m.reason}`);
    }
  }

  return enriched;
}

function finalizeRows(rows, existingAbbrevs) {
  return dedupeAbbrevs(rows, existingAbbrevs);
}

async function downloadTemplate(cookie) {
  const url = 'https://bimgroup.commeet.co/ap/api/file/downloadExampleXLSX?type=supplier';
  const res = await fetchFn(url, { headers: { Cookie: cookie } });
  if (!res.ok) throw new Error(`下載範本失敗 HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function fillImportSheet(wb, payeeRows) {
  const sheetName = '供應商資料';
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`範本缺少工作表：${sheetName}`);

  const exampleRow = 2;
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:AI1000');
  for (let c = range.s.c; c <= range.e.c; c++) {
    delete ws[XLSX.utils.encode_cell({ r: exampleRow, c })];
  }

  const col = {
    abbrev: 1,
    fullName: 2,
    type: 3,
    code: 4,
    payment: 5,
    idType: 6,
    idNumber: 7,
    currency: 8,
    paymentTerms: 9,
    supplierCharge: 10,
    accountName: 11,
    bankCode: 12,
    accountNo: 13,
    branchCode: 14,
  };

  payeeRows.forEach((row, i) => {
    const r = DATA_START_ROW + i;
    const set = (c, v) => {
      if (v === '' || v == null) return;
      ws[XLSX.utils.encode_cell({ r, c })] = { t: 's', v: String(v) };
    };
    set(col.abbrev, row.import_abbrev || row.proposed_abbrev || row.abbrev);
    set(col.fullName, row.name);
    set(col.type, row.supplier_type);
    set(col.code, row.proposed_supplier_code);
    set(col.payment, PAYMENT_METHODS);
    if (row.tax_id) {
      set(col.idType, '統一編號');
      set(col.idNumber, row.tax_id);
    }
    set(col.currency, CURRENCY);
    set(col.paymentTerms, PAYMENT_TERMS);
    set(col.supplierCharge, SUPPLIER_CHARGE);
    set(col.accountName, row.name);
    set(col.bankCode, row.bank_code);
    set(col.accountNo, row.account_no);
    set(col.branchCode, row.branch_code);
  });

  const ref = ws['!ref'];
  if (ref) {
    const rg = XLSX.utils.decode_range(ref);
    const lastRow = DATA_START_ROW + payeeRows.length - 1;
    if (lastRow > rg.e.r) rg.e.r = lastRow;
    ws['!ref'] = XLSX.utils.encode_range(rg);
  }
}

async function importSupplierViaBrowser(page, xlsxBuffer, fileName) {
  const base64 = xlsxBuffer.toString('base64');
  return page.evaluate(
    async ({ b64, fname }) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const fd = new FormData();
      fd.append('xlsx', blob, fname);
      const res = await fetch('/ap/api/supplier/importSupplier', { method: 'POST', body: fd });
      const ct = res.headers.get('content-type') || '';
      let body;
      try {
        body = ct.includes('application/json') ? await res.json() : await res.text();
      } catch {
        body = await res.text();
      }
      return { status: res.status, ok: res.ok, body };
    },
    { b64: base64, fname: fileName },
  );
}

async function loginAndGetPage() {
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
  await page.goto('https://bimgroup.commeet.co/ap/membercenter/supplierInfo', {
    waitUntil: 'domcontentloaded',
  });
  return { browser, page };
}

async function postImportPatch(page, rows) {
  const results = [];
  for (const row of rows) {
    const code = row.proposed_supplier_code;
    const j = await page.evaluate(async (c) => {
      const r = await fetch(`/ap/api/supplier/getSupplierList?keyword=${encodeURIComponent(c)}&limit=10`);
      return r.json();
    }, code);
    const item = j.result?.data?.find((x) => x.supplier_code === code);
    if (!item) {
      results.push({ code, ok: false, reason: '匯入後找不到供應商' });
      continue;
    }
    const d = await page.evaluate(async (id) => {
      const r = await fetch(`/ap/api/supplier/getSupplier/${id}`);
      return r.json();
    }, item.id);
    const sup = d.result;
    if (!sup) {
      results.push({ code, ok: false, reason: 'getSupplier 失敗' });
      continue;
    }
    const pm = sup.supplier_payment_methods.map((m) => ({
      id: m.supplier_payment_method_id,
      payment_method_type: m.payment_method_type,
      payment_name: m.payment_name,
    }));
    const body = {
      id: sup.id,
      abbreviation: sup.abbreviation,
      full_name: sup.full_name,
      supplier_code: sup.supplier_code,
      supplier_type_id: sup.supplier_type_info?.supplier_type_id,
      supplier_number_type: row.tax_id ? 1 : sup.supplier_number_info?.supplier_number_type ?? 0,
      supplier_number: row.tax_id || sup.supplier_number_info?.supplier_number || '',
      supplier_payment_methods: pm,
      payment_terms: sup.payment_terms || PAYMENT_TERMS,
      transaction_currency: sup.transaction_currency || CURRENCY,
      is_supplier_charge: true,
      is_enable: sup.is_enable,
      tw_account_transfer_infos: sup.tw_account_transfer_infos,
    };
    const res = await page.evaluate(async (p) => {
      const r = await fetch('/ap/api/supplier/updateSupplier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      return { status: r.status, body: await r.text() };
    }, body);
    results.push({
      code,
      ok: res.status === 200,
      charge: true,
      tax: row.tax_id || sup.supplier_number_info?.supplier_number || null,
    });
  }
  return results;
}

async function main() {
  const opts = parseArgs();
  const loadedRows = loadCBucketRows(opts);
  if (!loadedRows.length) {
    console.error('沒有符合條件的 C 桶資料');
    process.exit(1);
  }

  const { toImport: rawRows, skippedPersonal } = partitionPersonalRows(loadedRows, opts.skipPersonal);
  if (skippedPersonal.length) {
    appendPersonalSkipped(skippedPersonal);
    console.log(`\n⊘ 個人戶名跳過 ${skippedPersonal.length} 筆（不匯入 COMMEET）→ ${PERSONAL_SKIPPED_CSV}`);
    for (const s of skippedPersonal.slice(0, 8)) {
      console.log(`  - ${s.proposed_supplier_code} ${s.name}`);
    }
    if (skippedPersonal.length > 8) {
      console.log(`  ... 其餘 ${skippedPersonal.length - 8} 筆見 CSV`);
    }
  }

  if (!rawRows.length) {
    console.log('\n本批無需匯入的法人/機構戶，結束。');
    process.exit(0);
  }

  console.log(`\n準備匯入 ${rawRows.length} 筆（${rawRows[0].proposed_supplier_code} ~ ${rawRows[rawRows.length - 1].proposed_supplier_code}）`);
  console.log('查詢統編中（查不到會跳過並記錄）...');
  const enriched = await enrichRows(rawRows, opts);

  const { browser, page } = await loginAndGetPage();
  console.log('\nCOMMEET 登入成功');
  const existingAbbrevs = await fetchExistingAbbrevs(page);
  console.log(`COMMEET 既有簡稱 ${existingAbbrevs.size} 筆，自動避開重複`);
  const rows = finalizeRows(enriched, existingAbbrevs);

  const taxFound = rows.filter((r) => r.tax_id).length;
  console.log(`\n統編：${taxFound}/${rows.length} 筆自動帶入，${rows.length - taxFound} 筆待人工補`);

  try {
    const cookie = (await page.cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    const tplBuf = await downloadTemplate(cookie);
    const wb = XLSX.read(tplBuf, { type: 'buffer' });
    fillImportSheet(wb, rows);

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `commeet-import-c-${stamp}.xlsx`;
    const outXlsx = path.join(OUT, fileName);
    XLSX.writeFile(wb, outXlsx);
    console.log(`已產生匯入檔：${outXlsx}`);

    const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    console.log('\nPOST /ap/api/supplier/importSupplier ...');
    const result = await importSupplierViaBrowser(page, xlsxBuffer, fileName);

    let patchResults = [];
    if (result.ok && !result.body?.error_code) {
      console.log('\n匯入成功，補強手續費勾選與統編...');
      patchResults = await postImportPatch(page, rows);
      const patchOk = patchResults.filter((r) => r.ok).length;
      console.log(`後處理：${patchOk}/${patchResults.length} 筆 OK`);
    }

    const logPath = path.join(OUT, `import-result-${stamp}.json`);
    fs.writeFileSync(
      logPath,
      JSON.stringify({ opts, skippedPersonal, rows, result, patchResults }, null, 2),
      'utf8',
    );

    console.log('\n=== COMMEET 回應 ===');
    console.log('HTTP', result.status);
    console.log(JSON.stringify(result.body, null, 2));
    console.log(`\n完整紀錄：${logPath}`);
    if (fs.existsSync(TAX_MISSED_CSV)) {
      console.log(`統編待補清單：${TAX_MISSED_CSV}`);
    }
    if (fs.existsSync(PERSONAL_SKIPPED_CSV)) {
      console.log(`個人戶名跳過清單：${PERSONAL_SKIPPED_CSV}`);
    }

    if (result.body?.error_code || !result.ok) {
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('FAIL', e.message);
  process.exit(1);
});
