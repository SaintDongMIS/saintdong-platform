import * as XLSX from 'xlsx';
import { promises as fs } from 'fs';
import { DataEnrichmentService } from './DataEnrichmentService';
import { PaymentInheritanceService } from './PaymentInheritanceService';
import { excelLogger } from './LoggerService';
import { DateHelper } from '~/server/utils/dateHelper';

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
        headers,
      );

      excelLogger.info('Excel 解析完成', {
        totalRows: jsonData.length - 1,
        validRows: processedRows.length,
        skippedRows: skippedRows,
      });

      // 建立預先付款單索引
      const prepaymentIndex =
        PaymentInheritanceService.buildPrepaymentIndex(processedRows);

      // 為費用報銷單繼承付款資訊
      const enrichedRows = PaymentInheritanceService.enrichPaymentInfo(
        processedRows,
        prepaymentIndex,
      );

      return {
        headers,
        rows: enrichedRows,
        totalRows: jsonData.length - 1, // 減去標題行
        validRows: enrichedRows.length,
        skippedRows,
      };
    } catch (error) {
      excelLogger.error('Excel 解析錯誤', error);
      throw new Error(
        `Excel 檔案解析失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`,
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
    fileBuffer: Buffer,
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
    workbook: XLSX.WorkBook,
  ): Promise<XLSX.WorkSheet> {
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel 檔案中沒有找到工作表');
    }
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`工作表 "${sheetName}" 不存在或為空`);
    }
    return worksheet;
  }

  /**
   * 轉換為 JSON 格式
   */
  private static async convertToJson(
    worksheet: XLSX.WorkSheet,
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
    const headers = jsonData[0];
    if (!headers || headers.length === 0) {
      throw new Error('Excel 檔案沒有標題行');
    }
    // 確保只返回有效的字串標頭，並進行類型斷言
    return headers.filter((header) => {
      return typeof header === 'string' && header.trim() !== '';
    }) as string[];
  }

  /**
   * 處理資料行，增加對主-從結構資料的支援
   */
  private static async processDataRows(
    jsonData: any[][],
    headers: string[],
  ): Promise<{ processedRows: ExcelRow[]; skippedRows: number }> {
    const dataRows = jsonData.slice(1);

    const initialState = {
      processedRows: [] as ExcelRow[],
      skippedRows: 0,
      lastMasterRow: null as ExcelRow | null,
    };

    const finalState = dataRows.reduce((state, row) => {
      // 過濾完全空行
      if (this.isEmptyRow(row)) {
        return { ...state, skippedRows: state.skippedRows + 1 };
      }

      // 根據是否有表單編號，分派給不同的處理器
      const isDetailRow = this.isFormNumberEmpty(row, headers);

      return isDetailRow
        ? this.handleDetailRow(state, row, headers)
        : this.handleMasterRow(state, row, headers);
    }, initialState);

    return {
      processedRows: finalState.processedRows,
      skippedRows: finalState.skippedRows,
    };
  }

  /**
   * 處理主紀錄（有表單編號）
   */
  private static handleMasterRow(
    state: {
      processedRows: ExcelRow[];
      skippedRows: number;
      lastMasterRow: ExcelRow | null;
    },
    row: any[],
    headers: string[],
  ): typeof state {
    const processedRow = this.processRow(row, headers);

    // 檢查是否因表單狀態等原因被過濾
    if (processedRow === null) {
      return {
        ...state,
        skippedRows: state.skippedRows + 1,
        lastMasterRow: null, // 如果主紀錄無效，則後續的從屬紀錄也無效
      };
    }

    // 成功處理主紀錄
    return {
      ...state,
      processedRows: [...state.processedRows, processedRow],
      lastMasterRow: processedRow,
    };
  }

  /**
   * 處理從屬紀錄（沒有表單編號）
   */
  private static handleDetailRow(
    state: {
      processedRows: ExcelRow[];
      skippedRows: number;
      lastMasterRow: ExcelRow | null;
    },
    row: any[],
    headers: string[],
  ): typeof state {
    // 驗證：沒有主紀錄
    if (!state.lastMasterRow) {
      excelLogger.debug(
        '發現沒有主紀錄的從屬資料行，已跳過（主紀錄可能因狀態過濾被跳過）',
      );
      return { ...state, skippedRows: state.skippedRows + 1 };
    }

    // 驗證：空殼紀錄
    if (this.isEmptyDetailRow(row, headers)) {
      excelLogger.debug('發現無意義的空殼從屬紀錄，已跳過', {
        masterFormNumber: state.lastMasterRow['表單編號'],
      });
      return { ...state, skippedRows: state.skippedRows + 1 };
    }

    // 建立並處理從屬紀錄
    const detailRow = this.mergeDetailWithMaster(
      row,
      headers,
      state.lastMasterRow,
    );
    // this.handlePrepaymentForm(detailRow);
    this.sanitizeInheritedData(detailRow, state.lastMasterRow);

    // 成功處理從屬紀錄
    return {
      ...state,
      processedRows: [...state.processedRows, detailRow],
    };
  }

  /**
   * 從屬紀錄處理規則總覽（Commeet 主從結構）
   * ----------------------------------------
   * 第一階段 mergeDetailWithMaster：合併 Excel 從屬行與主紀錄
   *   - 有值的欄位才覆寫；以下四欄「空也覆寫」不繼承主紀錄：費用項目、會計科目、會計科目代號、會計科目原幣金額
   * 第二階段 sanitizeInheritedData：依類型清理不該出現的金額
   *   - 稅額行（會計科目=進項稅額）：清空項目金額、發票金額、分攤參與部門等，保留稅額與會計科目原幣金額
   *   - 分攤行（分攤部門與主紀錄不同）：清空項目金額、匯率、稅額、發票金額等，保留分攤金額與會計科目原幣金額
   *   - 會計科目為空時，會計科目原幣金額一併清空
   */
  /**
   * 合併從屬紀錄到主紀錄
   */
  private static mergeDetailWithMaster(
    row: any[],
    headers: string[],
    masterRow: ExcelRow,
  ): ExcelRow {
    const detailRow = { ...masterRow };

    // 1. 原始的標準繼承邏輯 (有值才覆寫)
    headers.forEach((header, index) => {
      const value = row[index];
      if (!this.isValueEmpty(value)) {
        const cleanedHeader = this.cleanHeaderName(header);
        detailRow[cleanedHeader] = this.cleanValue(value, header);
      }
    });

    // =================================================================
    // == 特殊規則：強制以從屬紀錄的空值覆寫特定欄位 (2025-10-21 新增) ==
    // == 若要恢復舊版行為，可將此區塊整個註解掉。                  ==
    // =================================================================
    const forceOverrideFields = [
      '費用項目',
      '會計科目',
      '會計科目代號',
      '會計科目原幣金額',
    ];
    forceOverrideFields.forEach((field) => {
      const headerIndex = headers.indexOf(field);
      if (headerIndex !== -1) {
        const value = row[headerIndex];
        // 即使 value 是空的，依然進行覆寫
        detailRow[field] = this.cleanValue(value, field);
      }
    });
    // =================================================================

    return detailRow;
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
        (typeof cell === 'string' && cell.trim() === ''),
    );
  }

  /**
   * 檢查表單編號是否為空
   */
  private static isFormNumberEmpty(row: any[], headers: string[]): boolean {
    const formNumberIndex = headers.findIndex(
      (header) => header === '表單編號',
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
   * 檢查從屬紀錄是否為無意義的空殼紀錄
   * 判斷標準：除了「憑證類別」之外，所有關鍵財務欄位都為空
   */
  private static isEmptyDetailRow(row: any[], headers: string[]): boolean {
    const keyFinancialFields = [
      '費用項目',
      '項目原幣金額',
      '項目本幣金額',
      '分攤金額',
      '會計科目',
      '會計科目代號',
      '會計科目原幣金額',
      '稅額',
      '發票未稅金額',
      '發票含稅金額',
      '發票號碼',
      '賣方統編',
    ];

    // 所有關鍵財務欄位都為空時，才是空殼紀錄
    return keyFinancialFields.every((field) => {
      const fieldIndex = headers.indexOf(field);
      if (fieldIndex < 0) return true; // 找不到欄位視為空
      return this.isValueEmpty(row[fieldIndex]);
    });
  }

  /**
   * 檢查值是否為空
   */
  public static isValueEmpty(value: any): boolean {
    if (value === null || value === undefined || value === '') return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    return false;
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
    // this.handlePrepaymentForm(rowObject);

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
    // 移除前後空白和開頭的星號（COMMEET Excel 欄位可能帶有 * 前綴）
    return header.trim().replace(/^\*/, '');
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
    return header.includes('日期') || header.includes('期限');
  }

  /**
   * 格式化日期
   */
  private static formatDate(value: string): string {
    // 處理 Excel 日期數字格式
    if (/^\d+$/.test(value)) {
      const excelDate = parseInt(value);
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return DateHelper.toLocalDate(date); // YYYY-MM-DD 格式，使用本地時區
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
    requiredFields: string[],
  ): void {
    this.validateHasRows(data);
    this.validateRequiredHeaders(data.headers, requiredFields);
    this.validateFirstRowData(data.rows, requiredFields);
  }

  /**
   * 驗證是否有資料行
   */
  private static validateHasRows(data: ProcessedExcelData): void {
    if (data.rows.length === 0) {
      throw new Error('Excel 檔案中沒有有效資料');
    }
  }

  /**
   * 驗證必要欄位是否存在於標題中
   */
  private static validateRequiredHeaders(
    headers: string[],
    requiredFields: string[],
  ): void {
    const missingFields = requiredFields.filter(
      (field) => !headers.includes(field),
    );

    if (missingFields.length > 0) {
      throw new Error(`缺少必要欄位: ${missingFields.join(', ')}`);
    }
  }

  /**
   * 驗證第一筆資料的必要欄位是否有值
   */
  private static validateFirstRowData(
    rows: ExcelRow[],
    requiredFields: string[],
  ): void {
    const firstRow = rows[0];
    if (!firstRow) {
      throw new Error('Excel 檔案中沒有有效的資料行');
    }

    const emptyField = requiredFields.find((field) =>
      this.isValueEmpty(firstRow[field]),
    );

    if (emptyField) {
      throw new Error(`第一筆資料的欄位 "${emptyField}" 不能為空`);
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
        row['付款銀行代碼']
      ) {
        const bankName = DataEnrichmentService.getBankNameByCode(
          row['付款銀行代碼'],
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

  /**
   * 從 Buffer 解析 Excel（用於 COMMEET API 下載的資料）
   *
   * 複用財務部的主從結構處理邏輯：
   * - 主紀錄：有表單編號的行
   * - 從屬紀錄：沒有表單編號的行，會繼承上一個主紀錄的資訊
   * - 過濾非「已核准」狀態的表單
   *
   * @param buffer Excel 檔案的 Buffer
   */
  static async parseExcelFromBuffer(
    buffer: Buffer,
  ): Promise<ProcessedExcelData> {
    try {
      excelLogger.info('開始從 Buffer 解析 Excel');

      // 直接從 Buffer 解析工作簿
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const worksheet = await this.getFirstWorksheet(workbook);

      excelLogger.info('轉換為 JSON 格式');
      const jsonData = await this.convertToJson(worksheet);
      const headers = await this.extractHeaders(jsonData);

      excelLogger.info('開始處理資料行');

      // 收集所有表單狀態值（用於除錯）
      const formStatusIndex = headers.indexOf('表單狀態');
      const formNumberIndex = headers.indexOf('表單編號');
      const statusMap = new Map<string, number>();

      jsonData.slice(1).forEach((row) => {
        // 只統計有表單編號的主紀錄
        if (formNumberIndex >= 0 && row[formNumberIndex]) {
          const status = row[formStatusIndex] || '(空)';
          statusMap.set(status, (statusMap.get(status) || 0) + 1);
        }
      });

      excelLogger.info('Excel 中的表單狀態分布', {
        statusDistribution: Object.fromEntries(statusMap),
      });

      // 複用財務部的 processDataRows（已包含主從結構、狀態過濾邏輯）
      const { processedRows, skippedRows } = await this.processDataRows(
        jsonData,
        headers,
      );

      // 清理金額欄位中的幣別文字（如 "USD 437.96" → "437.96"）
      const sanitizedRows = processedRows.map((row) =>
        this.sanitizeAmountFields(row),
      );

      // 清理 headers（移除星號等）
      const cleanedHeaders = headers.map((h) => this.cleanHeaderName(h));

      excelLogger.info('Excel Buffer 解析完成', {
        totalRows: jsonData.length - 1,
        validRows: sanitizedRows.length,
        skippedRows: skippedRows,
      });

      return {
        headers: cleanedHeaders,
        rows: sanitizedRows,
        totalRows: jsonData.length - 1,
        validRows: sanitizedRows.length,
        skippedRows,
      };
    } catch (error) {
      excelLogger.error('Excel Buffer 解析錯誤', error);
      throw new Error(
        `Excel Buffer 解析失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`,
      );
    }
  }

  /**
   * 清理金額欄位中的幣別文字
   * 例如："USD 437.96" → "437.96"
   *       "TWD 1,234.56" → "1234.56"
   */
  private static sanitizeAmountFields(row: ExcelRow): ExcelRow {
    const amountFields = ['分攤金額']; // 可擴展其他需要清理的金額欄位

    const sanitizedRow = { ...row };

    for (const field of amountFields) {
      const value = sanitizedRow[field];
      if (value && typeof value === 'string') {
        // 移除幣別代碼和空格，只保留數字和小數點
        const cleanedValue = this.extractNumericValue(value);
        if (cleanedValue !== null) {
          sanitizedRow[field] = cleanedValue;
        }
      }
    }

    return sanitizedRow;
  }

  /**
   * 從包含幣別的字串中提取數值
   * "USD 437.96" → "437.96"
   * "TWD 1,234.56" → "1234.56"
   * "-500.00" → "-500.00"
   * "" → ""
   */
  private static extractNumericValue(value: string): string | null {
    if (!value || value.trim() === '') {
      return '';
    }

    // 移除幣別代碼（3個大寫字母）和空格
    // 支援格式：USD 437.96, TWD 1,234.56, -500.00
    const cleaned = value
      .replace(/^[A-Z]{3}\s*/i, '') // 移除開頭的幣別代碼
      .replace(/,/g, '') // 移除千分位逗號
      .trim();

    // 驗證是否為有效數字
    if (cleaned === '' || isNaN(parseFloat(cleaned))) {
      return null; // 無法解析，返回 null 表示保持原值
    }

    return cleaned;
  }

  /**
   * 根據業務規則清理繼承來的資料，確保從屬紀錄的合理性
   * 修正規則：針對 Commeet 的「稅額行」和「分攤行」，把不該出現的金額數字清空
   * 參考：財務 Excel 處理金額修正說明
   */
  private static sanitizeInheritedData(
    detailRow: ExcelRow,
    masterRow: ExcelRow,
  ): void {
    // 規則一：處理稅額分錄（會計科目 = 進項稅額），比對前 trim 避免 Excel 空白導致漏判
    const accountName = String(detailRow['會計科目'] ?? '').trim();
    if (accountName === '進項稅額') {
      // 根據修正規則表：稅額行需要清空的欄位
      detailRow['項目原幣金額'] = '0';
      detailRow['項目本幣金額'] = '0';
      detailRow['匯率'] = '0';
      detailRow['分攤金額'] = '0';
      detailRow['發票未稅金額'] = '0';
      detailRow['發票含稅金額'] = '0';
      detailRow['分攤參與部門'] = '';

      // 保留的欄位：稅額、會計科目原幣金額
      // 注意：會計科目原幣金額應該保留為稅額金額，不是清空
      // 這個欄位在 mergeDetailWithMaster 中已經處理

      return; // 稅額行處理完畢，直接返回
    }

    // 規則二：處理費用分攤分錄（當分攤部門改變時），比對前 trim 避免空白導致誤判
    const detailDept = String(detailRow['分攤參與部門'] ?? '').trim();
    const masterDept = String(masterRow['分攤參與部門'] ?? '').trim();

    if (detailDept && masterDept && detailDept !== masterDept) {
      // 根據修正規則表：分攤行需要清空的欄位
      detailRow['項目原幣金額'] = '0';
      detailRow['項目本幣金額'] = '0';
      detailRow['匯率'] = '0';
      detailRow['稅額'] = '0';
      detailRow['發票未稅金額'] = '0';
      detailRow['發票含稅金額'] = '0';

      // 保留的欄位：分攤金額、會計科目原幣金額
      // 分攤金額在 mergeDetailWithMaster 中已經處理
      // 會計科目原幣金額在 mergeDetailWithMaster 中已經處理
    }

    // 規則三：確保會計科目與會計科目原幣金額的一致性
    // 當會計科目為空時，會計科目原幣金額也應該為空（NULL），保持資料一致性
    if (this.isValueEmpty(detailRow['會計科目'])) {
      detailRow['會計科目原幣金額'] = '';
    }
  }
}
