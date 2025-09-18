import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { DataEnrichmentService } from './DataEnrichmentService';

export interface ExcelRow {
  [key: string]: any;
}

export interface ProcessedExcelData {
  headers: string[];
  rows: ExcelRow[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
}

export class ExcelService {
  /**
   * 解析 Excel 或 CSV 檔案
   */
  static async parseExcel(filePath: string): Promise<ProcessedExcelData> {
    try {
      // 讀取檔案
      const fileBuffer = await fs.readFile(filePath);

      // 檢查檔案類型
      const fileExtension = filePath
        .toLowerCase()
        .substring(filePath.lastIndexOf('.'));
      let workbook;

      if (fileExtension === '.csv') {
        // 解析 CSV 檔案
        const csvString = fileBuffer.toString('utf-8');
        workbook = XLSX.read(csvString, { type: 'string' });
      } else {
        // 解析 Excel 檔案
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      }

      // 取得第一個工作表
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel 檔案中沒有找到工作表');
      }

      const worksheet = workbook.Sheets[sheetName];

      // 轉換為 JSON 格式
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // 使用陣列格式
        defval: '', // 空值預設為空字串
      });

      if (jsonData.length === 0) {
        throw new Error('Excel 檔案為空');
      }

      // 取得標題行
      const headers = jsonData[0] as string[];
      if (!headers || headers.length === 0) {
        throw new Error('Excel 檔案沒有標題行');
      }

      // 處理資料行
      const dataRows = jsonData.slice(1) as any[][];
      const processedRows: ExcelRow[] = [];
      let skippedRows = 0;

      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        // 檢查是否為空行（所有欄位都為空）
        const isEmptyRow = row.every(
          (cell) =>
            cell === null ||
            cell === undefined ||
            cell === '' ||
            (typeof cell === 'string' && cell.trim() === '')
        );

        if (isEmptyRow) {
          skippedRows++;
          continue;
        }

        // 檢查關鍵欄位是否為空（表單編號不能為空）
        const formNumberIndex = headers.findIndex(
          (header) => header === '表單編號'
        );
        if (formNumberIndex >= 0) {
          const formNumber = row[formNumberIndex];
          const isFormNumberEmpty =
            formNumber === null ||
            formNumber === undefined ||
            formNumber === '' ||
            (typeof formNumber === 'string' && formNumber.trim() === '');

          if (isFormNumberEmpty) {
            console.log(
              `⏭️ 跳過表單編號為空的資料行 (可能是稅額行): ${JSON.stringify(
                row
              )}`
            );
            skippedRows++;
            continue;
          }
        }

        // 建立物件格式的資料行
        const rowObject: ExcelRow = {};
        headers.forEach((header, index) => {
          const value = row[index];
          // 清理資料：去除前後空白，處理 null/undefined
          let cleanedValue =
            value === null || value === undefined ? '' : String(value).trim();

          // 特殊處理：金額欄位去除千分位逗號
          if (
            header.includes('金額') ||
            header.includes('總計') ||
            header.includes('稅額')
          ) {
            cleanedValue = cleanedValue.replace(/,/g, '');
          }

          // 特殊處理：日期格式
          if (header.includes('日期') && cleanedValue) {
            // 處理 Excel 日期數字格式
            if (/^\d+$/.test(cleanedValue)) {
              // 如果是純數字，轉換為日期格式
              const excelDate = parseInt(cleanedValue);
              const date = new Date((excelDate - 25569) * 86400 * 1000);
              cleanedValue = date.toISOString().split('T')[0]; // YYYY-MM-DD 格式
            } else {
              // 將 2025/09/18 格式轉換為 2025-09-18
              cleanedValue = cleanedValue.replace(/\//g, '-');
            }
          }

          rowObject[header] = cleanedValue;
        });

        processedRows.push(rowObject);
      }

      return {
        headers,
        rows: processedRows,
        totalRows: dataRows.length,
        validRows: processedRows.length,
        skippedRows,
      };
    } catch (error) {
      console.error('Excel 解析錯誤:', error);
      throw new Error(
        `Excel 檔案解析失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 驗證 Excel 資料格式
   */
  static validateExcelData(
    data: ProcessedExcelData,
    requiredFields: string[]
  ): void {
    if (data.rows.length === 0) {
      throw new Error('Excel 檔案中沒有有效資料');
    }

    // 檢查必要欄位
    const missingFields = requiredFields.filter(
      (field) => !data.headers.includes(field)
    );

    if (missingFields.length > 0) {
      throw new Error(`缺少必要欄位: ${missingFields.join(', ')}`);
    }

    // 檢查第一筆資料的格式
    const firstRow = data.rows[0];
    for (const field of requiredFields) {
      if (!firstRow[field] || firstRow[field].toString().trim() === '') {
        throw new Error(`第一筆資料的欄位 "${field}" 不能為空`);
      }
    }
  }

  /**
   * 擴充資料，例如根據銀行代碼填寫銀行名稱
   */
  static enrichBankData(rows: ExcelRow[]): void {
    for (const row of rows) {
      // 檢查是否符合條件：是員工，且付款銀行名稱為空
      if (
        row['供應商/銀行/員工'] === '員工' &&
        !row['付款銀行名稱'] &&
        row['付款銀行代號']
      ) {
        const bankName = DataEnrichmentService.getBankNameByCode(
          row['付款銀行代號']
        );
        if (bankName) {
          row['付款銀行名稱'] = bankName;
        }
      }
    }
  }

  /**
   * 清理檔案
   */
  static async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ 已清理暫存檔案: ${filePath}`);
    } catch (error) {
      console.error('清理檔案失敗:', error);
    }
  }
}
