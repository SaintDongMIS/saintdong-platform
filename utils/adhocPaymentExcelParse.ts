import * as XLSX from 'xlsx';
import { BankConvertAdhocConfig } from '~/constants/bankConvertAdhoc';
import {
  accountDigitsPreserve,
  cellString,
  parseAmountToAmount14,
  type CommeetWireExportRow,
} from './commeetBankExcelParse';
import type { AdhocWireExtractResult } from './adhocBankWireParse';

const COL = BankConvertAdhocConfig.PAYMENT_EXCEL.COLUMNS;
const BLANK_MARKERS = BankConvertAdhocConfig.PAYMENT_EXCEL.BLANK_MARKERS;

function isBlankCell(value: unknown): boolean {
  const s = cellString(value);
  if (!s) return true;
  return BLANK_MARKERS.some((m) => s === m);
}

function isExcelRowEmpty(row: unknown[]): boolean {
  if (!row?.length) return true;
  return row.every((c) => isBlankCell(c));
}

function findHeaderRowIndex(jsonData: unknown[][]): number {
  for (let i = 0; i < Math.min(jsonData.length, 30); i++) {
    const row = jsonData[i];
    if (!Array.isArray(row)) continue;
    const method = cellString(row[COL.PAYMENT_METHOD]);
    const bank = cellString(row[COL.BANK_CODE]);
    if (method.includes('付款方式') && bank.includes('銀行')) {
      return i;
    }
  }
  return -1;
}

/** 會計清單「銀行代碼」可為 3 碼或 7 碼（含分行） */
export function parseAccountingBankCode(raw: unknown): {
  bank3: string;
  branch4: string;
  bank7: string;
} | null {
  const digits = cellString(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length >= 7) {
    return {
      bank3: digits.slice(0, 3),
      branch4: digits.slice(3, 7),
      bank7: digits.slice(0, 7),
    };
  }
  const bank3 = digits.padStart(3, '0').slice(-3);
  return { bank3, branch4: '0000', bank7: `${bank3}0000` };
}

export function readAdhocPaymentSheetMatrix(
  input: Buffer | ArrayBuffer
):
  | { ok: true; jsonData: unknown[][]; sheetName: string }
  | { ok: false; error: string } {
  const workbook =
    typeof Buffer !== 'undefined' && Buffer.isBuffer(input)
      ? XLSX.read(input as Buffer, { type: 'buffer' })
      : XLSX.read(new Uint8Array(input as ArrayBuffer), { type: 'array' });

  const preferred = workbook.SheetNames.find((n) => n.includes('匯款'));
  const sheetName = preferred ?? workbook.SheetNames[0];
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

/**
 * 會計付款清單（Payment_YYYYMMDD.xlsx 等）：「匯款」區塊內有銀行／帳號／合計之列
 */
export function extractAdhocPaymentExcelWireRows(
  jsonData: unknown[][]
):
  | { ok: false; error: string }
  | { ok: true; data: AdhocWireExtractResult; headerRowIndex: number } {
  const headerRowIndex = findHeaderRowIndex(jsonData);
  if (headerRowIndex < 0) {
    return {
      ok: false,
      error:
        '找不到會計付款清單表頭（須含「付款方式」「銀行代碼」等欄）。請確認為 Payment 匯款工作表。',
    };
  }

  const cfg = BankConvertAdhocConfig.PAYMENT_EXCEL;
  const rows: CommeetWireExportRow[] = [];
  const lineNotes: string[] = [];
  let skippedInvalid = 0;
  let totalInputRows = 0;
  let inWireBlock = false;
  let lastPayeeName = '';

  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!Array.isArray(row) || isExcelRowEmpty(row)) continue;

    const method = cellString(row[COL.PAYMENT_METHOD]);
    if (method === cfg.WIRE_BLOCK_START) {
      inWireBlock = true;
      lastPayeeName = '';
    } else if (
      method.includes(cfg.WIRE_BLOCK_START) &&
      method.includes(cfg.WIRE_BLOCK_END_MARK)
    ) {
      inWireBlock = false;
      lastPayeeName = '';
      continue;
    }
    if (!inWireBlock) continue;

    totalInputRows++;

    const payeeCell = cellString(row[COL.PAYEE_NAME]).trim();
    if (payeeCell) lastPayeeName = payeeCell;
    const payeeName = lastPayeeName;
    const lineNote = cellString(row[COL.LINE_NOTE]).trim();
    const bankParsed = parseAccountingBankCode(row[COL.BANK_CODE]);
    const accountDigits = accountDigitsPreserve(row[COL.ACCOUNT]);
    const amountCell = row[COL.AMOUNT];

    if (!payeeName || !bankParsed || !accountDigits || isBlankCell(amountCell)) {
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

    const bankNameLabel = cellString(row[COL.BANK_NAME]);
    rows.push({
      formNo: '',
      payeeName,
      payeeTaxId: '',
      bankDigits: bankParsed.bank3,
      branchDigits4: bankParsed.branch4,
      branchCellRaw: row[COL.BANK_CODE],
      bankNameLabel,
      receivingBankDisplay: bankNameLabel
        ? `${bankParsed.bank7} ${bankNameLabel}`.trim()
        : bankParsed.bank7,
      accountDigits,
      amount14,
      payeeBank3: bankParsed.bank3,
      payeeBankCode7: bankParsed.bank7,
    });
    lineNotes.push(lineNote);
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: `未找到可轉檔的匯款列（略過 ${skippedInvalid} 筆；請確認「匯款」區塊含銀行代碼與帳號）`,
    };
  }

  return {
    ok: true,
    headerRowIndex,
    data: {
      rows,
      lineNotes,
      skippedInvalid,
      totalInputRows,
    },
  };
}
