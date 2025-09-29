import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { DataEnrichmentService } from './DataEnrichmentService';
import { excelLogger } from './LoggerService';

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
      excelLogger.info('開始讀取檔案');
      const fileBuffer = await this.readFile(filePath);

      excelLogger.info('開始解析工作簿');
      const workbook = await this.parseWorkbook(filePath, fileBuffer);
      const worksheet = await this.getFirstWorksheet(workbook);

      excelLogger.info('轉換為 JSON 格式');
      const jsonData = await this.convertToJson(worksheet);
      const headers = await this.extractHeaders(jsonData);

      excelLogger.info('開始處理資料行');
      const { processedRows, skippedRows } = await this.processDataRows(
        jsonData,
        headers
      );

      excelLogger.info('Excel 解析完成', {
        totalRows: jsonData.length - 1,
        validRows: processedRows.length,
        skippedRows: skippedRows,
      });

      return {
        headers,
        rows: processedRows,
        totalRows: jsonData.length - 1, // 減去標題行
        validRows: processedRows.length,
        skippedRows,
      };
    } catch (error) {
      excelLogger.error('Excel 解析錯誤', error);
      throw new Error(
        `Excel 檔案解析失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 讀取檔案
   */
  private static async readFile(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  /**
   * 解析工作簿
   */
  private static async parseWorkbook(
    filePath: string,
    fileBuffer: Buffer
  ): Promise<XLSX.WorkBook> {
    const fileExtension = filePath
      .toLowerCase()
      .substring(filePath.lastIndexOf('.'));

    if (fileExtension === '.csv') {
      const csvString = fileBuffer.toString('utf-8');
      return XLSX.read(csvString, { type: 'string' });
    } else {
      return XLSX.read(fileBuffer, { type: 'buffer' });
    }
  }

  /**
   * 取得第一個工作表
   */
  private static async getFirstWorksheet(
    workbook: XLSX.WorkBook
  ): Promise<XLSX.WorkSheet> {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel 檔案中沒有找到工作表');
    }
    return workbook.Sheets[sheetName];
  }

  /**
   * 轉換為 JSON 格式
   */
  private static async convertToJson(
    worksheet: XLSX.WorkSheet
  ): Promise<any[][]> {
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
    }) as any[][];

    if (jsonData.length === 0) {
      throw new Error('Excel 檔案為空');
    }

    return jsonData;
  }

  /**
   * 提取標題行
   */
  private static async extractHeaders(jsonData: any[][]): Promise<string[]> {
    const headers = jsonData[0] as string[];
    if (!headers || headers.length === 0) {
      throw new Error('Excel 檔案沒有標題行');
    }
    return headers;
  }

  /**
   * 處理資料行
   */
  private static async processDataRows(
    jsonData: any[][],
    headers: string[]
  ): Promise<{ processedRows: ExcelRow[]; skippedRows: number }> {
    const dataRows = jsonData.slice(1) as any[][];
    const processedRows: ExcelRow[] = [];
    let skippedRows = 0;

    for (const row of dataRows) {
      const shouldSkip = this.shouldSkipRow(row, headers);
      if (shouldSkip) {
        skippedRows++;
        continue;
      }

      const processedRow = this.processRow(row, headers);
      // 檢查是否因為表單狀態被跳過
      if (processedRow === null) {
        skippedRows++;
        continue;
      }

      processedRows.push(processedRow);
    }

    return { processedRows, skippedRows };
  }

  /**
   * 判斷是否應該跳過該行
   */
  private static shouldSkipRow(row: any[], headers: string[]): boolean {
    // 檢查是否為空行
    if (this.isEmptyRow(row)) {
      return true;
    }

    // 檢查表單編號是否為空
    if (this.isFormNumberEmpty(row, headers)) {
      excelLogger.debug('跳過表單編號為空的資料行 (可能是稅額行)', { row });
      return true;
    }

    return false;
  }

  /**
   * 檢查是否為空行
   */
  private static isEmptyRow(row: any[]): boolean {
    return row.every(
      (cell) =>
        cell === null ||
        cell === undefined ||
        cell === '' ||
        (typeof cell === 'string' && cell.trim() === '')
    );
  }

  /**
   * 檢查表單編號是否為空
   */
  private static isFormNumberEmpty(row: any[], headers: string[]): boolean {
    const formNumberIndex = headers.findIndex(
      (header) => header === '表單編號'
    );
    if (formNumberIndex < 0) return false;

    const formNumber = row[formNumberIndex];
    return (
      formNumber === null ||
      formNumber === undefined ||
      formNumber === '' ||
      (typeof formNumber === 'string' && formNumber.trim() === '')
    );
  }

  /**
   * 處理單行資料
   */
  private static processRow(row: any[], headers: string[]): ExcelRow {
    const rowObject: ExcelRow = {};

    headers.forEach((header, index) => {
      const value = row[index];
      const cleanedValue = this.cleanValue(value, header);
      const cleanedHeader = this.cleanHeaderName(header);
      rowObject[cleanedHeader] = cleanedValue;
    });

    // 檢查表單狀態，只有「已核准」的才處理
    const formStatus = rowObject['表單狀態'];
    if (formStatus && formStatus !== '已核准') {
      excelLogger.debug('跳過非已核准狀態的表單', {
        formNumber: rowObject['表單編號'],
        formStatus: formStatus,
      });
      // 返回 null 表示應該跳過這筆資料
      return null as any;
    }

    // 處理預先付款單的會計科目設定
    this.handlePrepaymentForm(rowObject);

    return rowObject;
  }

  /**
   * 清理資料值
   */
  private static cleanValue(value: any, header: string): string {
    // 基本清理
    let cleanedValue =
      value === null || value === undefined ? '' : String(value).trim();

    // 金額欄位處理
    if (this.isAmountField(header)) {
      cleanedValue = cleanedValue.replace(/,/g, '');
    }

    // 日期欄位處理
    if (this.isDateField(header) && cleanedValue) {
      cleanedValue = this.formatDate(cleanedValue);
    }

    return cleanedValue;
  }

  /**
   * 清理欄位名稱，移除特殊字元
   */
  private static cleanHeaderName(header: string): string {
    // 移除開頭的星號
    return header.replace(/^\*/, '');
  }

  /**
   * 處理預先付款單的會計科目設定
   */
  private static handlePrepaymentForm(rowObject: ExcelRow): void {
    // 檢查是否為預先付款單
    if (rowObject['表單種類'] === '預先付款單') {
      excelLogger.info('偵測到預先付款單，自動設定會計科目', {
        formNumber: rowObject['表單編號'],
        originalAccountCode: rowObject['會計科目代號'],
        originalAccountName: rowObject['會計科目'],
      });

      // 自動設定會計科目
      rowObject['會計科目代號'] = '1265';
      rowObject['會計科目'] = '預付費用';

      excelLogger.info('預先付款單會計科目已更新', {
        formNumber: rowObject['表單編號'],
        newAccountCode: rowObject['會計科目代號'],
        newAccountName: rowObject['會計科目'],
      });
    }
  }

  /**
   * 判斷是否為金額欄位
   */
  private static isAmountField(header: string): boolean {
    return (
      header.includes('金額') ||
      header.includes('總計') ||
      header.includes('稅額')
    );
  }

  /**
   * 判斷是否為日期欄位
   */
  private static isDateField(header: string): boolean {
    return header.includes('日期');
  }

  /**
   * 格式化日期
   */
  private static formatDate(value: string): string {
    // 處理 Excel 日期數字格式
    if (/^\d+$/.test(value)) {
      const excelDate = parseInt(value);
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD 格式
    } else {
      // 將 2025/09/18 格式轉換為 2025-09-18
      return value.replace(/\//g, '-');
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
      excelLogger.info(`已清理暫存檔案: ${filePath}`);
    } catch (error) {
      excelLogger.error('清理檔案失敗', error);
    }
  }
}
