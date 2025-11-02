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

        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          resolve({ isValid: false, message: 'Excel 檔案中沒有任何工作表。' });
          return;
        }

        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          resolve({ isValid: false, message: 'Excel 檔案中沒有任何工作表。' });
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];

        if (!worksheet) {
          resolve({ isValid: false, message: '無法讀取第一個工作表。' });
          return;
        }

        // 取得標頭列 (A1, B1, C1...)
        const headers: string[] = [];
        const sheetRef = worksheet['!ref'];

        if (sheetRef) {
          const range = XLSX.utils.decode_range(sheetRef);
          for (let C = range.s.c; C <= range.e.c; ++C) {
            const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: C });
            const cell = worksheet[cellAddress];
            headers.push(cell && cell.v ? String(cell.v) : '');
          }
        }

        // 規則 1: 檢查是否包含所有必要欄位
        if (config.requiredFields) {
          const missingFields = config.requiredFields.filter(
            (field) => !headers.includes(field)
          );
          if (missingFields.length > 0) {
            resolve({
              isValid: false,
              message: `檔案格式不符。缺少必要欄位：${missingFields.join(
                ', '
              )}`,
            });
            return;
          }
        }

        // 規則 2: 檢查是否包含任何禁止的欄位
        if (config.forbiddenFields) {
          const foundForbiddenFields = config.forbiddenFields.filter((field) =>
            headers.includes(field)
          );
          if (foundForbiddenFields.length > 0) {
            resolve({
              isValid: false,
              message: `檔案上傳到錯誤的部門。此檔案包含 ${foundForbiddenFields.join(
                ', '
              )} 欄位，應為其他部門的檔案。`,
            });
            return;
          }
        }

        // 所有驗證通過
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
