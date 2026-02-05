import * as XLSX from 'xlsx';
import type { DepartmentValidationConfig } from '~/utils/departmentConfig';

/**
 * Excel 檔案驗證結果介面
 */
export interface ExcelValidationResult {
  /** 是否通過驗證 */
  isValid: boolean;
  /** 錯誤訊息 (如果驗證失敗) */
  message?: string;
}

/** 樞紐表固定資料欄（這些欄可含數字，不要求為日期） */
const PIVOT_METADATA_HEADERS = [
  '派工單號',
  '廠商名稱',
  '品名',
  '單位',
  '單價',
];

/**
 * 將標題值解析為日期字串 YYYY-MM-DD，無法解析則回傳 null
 */
function parseHeaderToDateString(header: unknown): string | null {
  if (header == null || header === '') return null;

  if (typeof header === 'number' && Number.isFinite(header)) {
    const d = new Date(1899, 11, 30);
    d.setDate(d.getDate() + header);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0] ?? null;
    }
    return null;
  }

  const s = String(header).trim();
  if (!s) return null;

  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1]!, 10);
    const day = parseInt(slashMatch[2]!, 10);
    let year = parseInt(slashMatch[3]!, 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime()) && d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
      return d.toISOString().split('T')[0] ?? null;
    }
  }

  const monthDayMatch = s.match(/(\d+)月(\d+)日/);
  if (monthDayMatch) {
    const year = new Date().getFullYear();
    const month = parseInt(monthDayMatch[1]!, 10);
    const day = parseInt(monthDayMatch[2]!, 10);
    const d = new Date(year, month - 1, day);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0] ?? null;
    }
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0] ?? null;
  }

  return null;
}

function getTodayDateString(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const d = String(t.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 回傳 null 表示通過，否則回傳錯誤結果 */
function validateRequiredFields(
  headers: string[],
  config: DepartmentValidationConfig
): ExcelValidationResult | null {
  if (!config.requiredFields) return null;
  const missing = config.requiredFields.filter((f) => !headers.includes(f));
  if (missing.length === 0) return null;
  return {
    isValid: false,
    message: `檔案格式不符。缺少必要欄位：${missing.join(', ')}`,
  };
}

/** 回傳 null 表示通過 */
function validateForbiddenFields(
  headers: string[],
  config: DepartmentValidationConfig
): ExcelValidationResult | null {
  if (!config.forbiddenFields) return null;
  const found = config.forbiddenFields.filter((f) => headers.includes(f));
  if (found.length === 0) return null;
  return {
    isValid: false,
    message: `檔案上傳到錯誤的部門。此檔案包含 ${found.join(', ')} 欄位，應為其他部門的檔案。`,
  };
}

/** 回傳 null 表示通過 */
function validateNoFutureDates(
  rawHeaderValues: unknown[],
  config: DepartmentValidationConfig
): ExcelValidationResult | null {
  if (!config.validateNoFutureDates) return null;
  const today = getTodayDateString();
  for (let i = 0; i < rawHeaderValues.length; i++) {
    const dateStr = parseHeaderToDateString(rawHeaderValues[i]);
    if (dateStr && dateStr > today) {
      return {
        isValid: false,
        message: `檔案內含未來日期（${dateStr}），請修正後再上傳。`,
      };
    }
  }
  return null;
}

/** 回傳 null 表示通過 */
function validateNoQuantityWithoutDate(
  worksheet: XLSX.WorkSheet,
  sheetRef: string,
  headers: string[],
  rawHeaderValues: unknown[],
  config: DepartmentValidationConfig
): ExcelValidationResult | null {
  if (!config.validateNoQuantityWithoutDate) return null;
  const range = XLSX.utils.decode_range(sheetRef);
  for (let c = 0; c < rawHeaderValues.length; c++) {
    if (PIVOT_METADATA_HEADERS.includes(headers[c] ?? '')) continue;
    if (parseHeaderToDateString(rawHeaderValues[c]) !== null) continue;

    const col = range.s.c + c;
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: col })];
      const v = cell?.v;
      if (v == null) continue;
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (Number.isFinite(num) && num !== 0) {
        return {
          isValid: false,
          message: '有欄位缺少日期標題但含有數量，請補上對應日期後再上傳。',
        };
      }
    }
  }
  return null;
}

function getWorkbookAndFirstSheet(
  data: ArrayBuffer
): ExcelValidationResult | { worksheet: XLSX.WorkSheet; sheetRef: string | undefined; headers: string[]; rawHeaderValues: unknown[] } {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
  if (!workbook.SheetNames?.length) {
    return { isValid: false, message: 'Excel 檔案中沒有任何工作表。' };
  }
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return { isValid: false, message: 'Excel 檔案中沒有任何工作表。' };
  }
  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    return { isValid: false, message: '無法讀取第一個工作表。' };
  }

  const headers: string[] = [];
  const rawHeaderValues: unknown[] = [];
  const sheetRef = worksheet['!ref'];
  if (sheetRef) {
    const range = XLSX.utils.decode_range(sheetRef);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      const raw = cell?.v;
      rawHeaderValues.push(raw != null && raw !== '' ? raw : null);
      headers.push(raw != null && raw !== '' ? String(raw) : '');
    }
  }

  return { worksheet, sheetRef, headers, rawHeaderValues };
}

/**
 * 驗證 Excel 檔案標頭的 Composable
 *
 * @param file - 使用者上傳的 File 物件
 * @param config - 該部門的驗證設定
 * @returns Promise<ExcelValidationResult> - 驗證結果
 */
export const useExcelValidator = async (
  file: File,
  config: DepartmentValidationConfig
): Promise<ExcelValidationResult> => {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        if (!e.target?.result) {
          resolve({ isValid: false, message: '無法讀取檔案內容。' });
          return;
        }

        const load = getWorkbookAndFirstSheet(e.target.result as ArrayBuffer);
        if (!('worksheet' in load)) {
          resolve(load);
          return;
        }

        const { worksheet, sheetRef, headers, rawHeaderValues } = load;

        const r1 = validateRequiredFields(headers, config);
        if (r1) {
          resolve(r1);
          return;
        }
        const r2 = validateForbiddenFields(headers, config);
        if (r2) {
          resolve(r2);
          return;
        }
        const r3 = validateNoFutureDates(rawHeaderValues, config);
        if (r3) {
          resolve(r3);
          return;
        }
        if (sheetRef) {
          const r4 = validateNoQuantityWithoutDate(
            worksheet,
            sheetRef,
            headers,
            rawHeaderValues,
            config
          );
          if (r4) {
            resolve(r4);
            return;
          }
        }

        resolve({ isValid: true });
      } catch (error) {
        console.error('解析 Excel 檔案時發生錯誤:', error);
        resolve({
          isValid: false,
          message: '解析檔案時發生錯誤，請確認檔案格式是否正確。',
        });
      }
    };

    reader.onerror = () => {
      resolve({ isValid: false, message: '讀取檔案時發生錯誤。' });
    };

    reader.readAsArrayBuffer(file);
  });
};
