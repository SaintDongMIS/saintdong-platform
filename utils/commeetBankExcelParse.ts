import * as XLSX from 'xlsx';
import type { BankConvertCommeetConfigType } from '~/constants/bankConvertCommeet';

/** 通過檢核之「匯款」資料列（供轉檔與前端預覽共用） */
export interface CommeetWireExportRow {
  formNo: string;
  payeeName: string;
  payeeTaxId: string;
  bankDigits: string;
  bankNameLabel: string;
  receivingBankDisplay: string;
  accountDigits: string;
  amount14: string;
  payeeBank3: string;
}

function cleanExcelHeader(value: unknown): string {
  if (value == null || value === '') return '';
  return String(value).trim().replace(/^\*/, '');
}

function isExcelRowEmpty(row: unknown[]): boolean {
  if (!row || !row.length) return true;
  return row.every(
    (c) =>
      c === null ||
      c === undefined ||
      c === '' ||
      (typeof c === 'string' && c.trim() === '')
  );
}

export function cellString(value: unknown): string {
  if (value == null || value === undefined) return '';
  return String(value).trim();
}

function bankCodeDigitsOnly(value: unknown): string {
  return cellString(value).replace(/\D/g, '');
}

export function accountDigitsPreserve(value: unknown): string {
  if (value == null || value === undefined) return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    return String(Math.trunc(value));
  }
  return String(value).replace(/[^\d]/g, '');
}

export function parseAmountToAmount14(cell: unknown): string {
  if (cell === null || cell === undefined || cell === '') {
    throw new Error('金額為空');
  }
  if (typeof cell === 'number' && Number.isFinite(cell)) {
    const cents = Math.round(cell * 100);
    if (cents < 0) throw new Error('金額不可為負');
    return String(cents).padStart(14, '0');
  }
  const s = String(cell).trim().replace(/,/g, '');
  const m = s.match(/^(\d+)\.(\d{2})$/);
  if (m && m[1] && m[2]) {
    const cents = parseInt(m[1] + m[2], 10);
    if (!Number.isFinite(cents) || cents < 0) throw new Error('金額格式錯誤');
    return String(cents).padStart(14, '0');
  }
  if (/^\d+$/.test(s)) {
    const yuan = parseInt(s, 10);
    const cents = yuan * 100;
    return String(cents).padStart(14, '0');
  }
  throw new Error(`無法解析金額：${s}`);
}

export function formatReceivingBankCode7(bankDigits: string): string {
  return (bankDigits.padStart(3, '0').slice(-3) + '0000').slice(0, 7);
}

export function formatTwdAmountFromAmount14(amount14: string): string {
  const cents = parseInt(amount14, 10);
  if (!Number.isFinite(cents)) return '';
  const yuan = Math.floor(cents / 100);
  const dec = cents % 100;
  return (
    yuan.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) +
    '.' +
    String(dec).padStart(2, '0')
  );
}

function buildReceivingBankDisplay(
  bankDigits: string,
  bankNameRaw: unknown
): string {
  const code7 = formatReceivingBankCode7(bankDigits);
  const name = cellString(bankNameRaw);
  if (name) return `${code7} ${name}`.trim();
  return code7;
}

export function readCommeetSheetMatrix(
  input: Buffer | ArrayBuffer,
  cfg: BankConvertCommeetConfigType
):
  | { ok: true; jsonData: unknown[][]; sheetName: string }
  | { ok: false; error: string } {
  const workbook =
    typeof Buffer !== 'undefined' && Buffer.isBuffer(input)
      ? XLSX.read(input as Buffer, { type: 'buffer' })
      : XLSX.read(new Uint8Array(input as ArrayBuffer), { type: 'array' });

  const sheetName = workbook.SheetNames.includes(cfg.SHEET_NAME)
    ? cfg.SHEET_NAME
    : workbook.SheetNames[0];
  if (!sheetName) {
    return { ok: false, error: 'Excel 檔案中沒有工作表' };
  }
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { ok: false, error: `無法讀取工作表「${sheetName}」` };
  }

  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    raw: true,
  }) as unknown[][];

  if (!jsonData.length) {
    return { ok: false, error: 'Excel 工作表為空' };
  }

  return { ok: true, jsonData, sheetName };
}

export function extractCommeetWireExportRows(
  jsonData: unknown[][],
  cfg: BankConvertCommeetConfigType
):
  | { ok: false; error: string }
  | {
      ok: true;
      rows: CommeetWireExportRow[];
      skippedNonWire: number;
      skippedInvalid: number;
      totalDataRows: number;
    } {
  const rawHeaders = jsonData[0] as unknown[];
  const headers = rawHeaders.map((h) => cleanExcelHeader(h));
  const missing = cfg.REQUIRED_HEADERS.filter((req) => !headers.includes(req));
  if (missing.length > 0) {
    return { ok: false, error: `Excel 缺少必要欄位：${missing.join('、')}` };
  }

  const idxMethod = headers.indexOf(cfg.HEADER.PAYMENT_METHOD);
  const idxPayeeName = headers.indexOf(cfg.HEADER.PAYEE_NAME);
  const idxBankCode = headers.indexOf(cfg.HEADER.BANK_CODE);
  const idxAccount = headers.indexOf(cfg.HEADER.ACCOUNT);
  const idxAmount = headers.indexOf(cfg.HEADER.AMOUNT);
  const idxFormNo = headers.indexOf(cfg.HEADER.FORM_NO);
  const idxTaxId = headers.indexOf(cfg.HEADER.PAYEE_TAX_ID);
  const idxBankName = headers.indexOf(cfg.HEADER.BANK_NAME);

  const dataRows = jsonData.slice(1);
  const rows: CommeetWireExportRow[] = [];
  let skippedNonWire = 0;
  let skippedInvalid = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row)) continue;
    if (isExcelRowEmpty(row)) continue;

    const method = cellString(row[idxMethod]);
    if (method !== cfg.PAYMENT_METHOD_WIRE) {
      skippedNonWire++;
      continue;
    }

    const payeeName = cellString(row[idxPayeeName]).trim();
    const bankCodeRaw = row[idxBankCode];
    const accountRaw = row[idxAccount];
    const amountCell = row[idxAmount];
    const formNo = idxFormNo >= 0 ? cellString(row[idxFormNo]) : '';
    const payeeTaxId =
      idxTaxId >= 0 ? cellString(row[idxTaxId]) : '';

    const bankDigits = bankCodeDigitsOnly(bankCodeRaw);
    const accountDigits = accountDigitsPreserve(accountRaw);
    if (!payeeName || !bankDigits || !accountDigits || amountCell === '' || amountCell == null) {
      skippedInvalid++;
      continue;
    }

    let amount14: string;
    try {
      amount14 = parseAmountToAmount14(amountCell);
    } catch {
      skippedInvalid++;
      continue;
    }

    const payeeBank3 = bankDigits.padStart(3, '0').slice(-3);
    const amount17 = amount14 + payeeBank3;
    if (amount17.length !== 17) {
      skippedInvalid++;
      continue;
    }

    const bankNameRaw = idxBankName >= 0 ? row[idxBankName] : '';
    rows.push({
      formNo,
      payeeName,
      payeeTaxId,
      bankDigits,
      bankNameLabel: cellString(bankNameRaw),
      receivingBankDisplay: buildReceivingBankDisplay(bankDigits, bankNameRaw),
      accountDigits,
      amount14,
      payeeBank3,
    });
  }

  return {
    ok: true,
    rows,
    skippedNonWire,
    skippedInvalid,
    totalDataRows: dataRows.length,
  };
}
