import * as XLSX from 'xlsx';
import { excelLogger } from './LoggerService';

/**
 * 日期標題介面
 */
interface DateHeader {
  columnIndex: number;
  originalText: string;
  date: Date;
}

/**
 * 道路施工部資料行介面（對應資料表結構）
 */
export interface RoadConstructionRow {
  派工單號: string;
  項目名稱: string;
  日期: string; // YYYY-MM-DD
  數量金額: number;
  備註: string | null;
}

/**
 * 道路施工部 Excel 資料介面
 */
export interface RoadConstructionExcelData {
  workOrderNumber: string;
  totalRecords: number;
  normalizedRows: RoadConstructionRow[];
  dateRange: {
    start: string;
    end: string;
  };
}

/**
 * 道路施工部 Excel 解析服務
 * 專門處理樞紐表結構的 Excel 檔案
 */
export class RoadConstructionExcelService {
  /**
   * 解析道路施工部樞紐表 Excel
   */
  static async parsePivotTableExcel(
    filePath: string,
    fileName: string
  ): Promise<RoadConstructionExcelData> {
    try {
      excelLogger.info('開始解析道路施工部 Excel', {
        fileName,
        filePath,
      });

      const workOrderNumber = this.extractWorkOrderNumber(fileName);
      excelLogger.debug('派工單號提取成功', { workOrderNumber });

      const workbook = await this.readExcelFile(filePath);
      const worksheet = this.getFirstWorksheet(workbook);

      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
      }) as any[][];

      if (jsonData.length === 0) {
        throw new Error('Excel 檔案為空，沒有資料');
      }

      excelLogger.debug('Excel 資料讀取成功', {
        totalRows: jsonData.length,
        firstRowColumns: jsonData[0]?.length || 0,
      });

      const headerRow = jsonData[0];
      if (!headerRow) {
        throw new Error('Excel 檔案標題列為空');
      }

      const dateHeaders = this.parseDateHeaders(headerRow);

      if (dateHeaders.length === 0) {
        throw new Error('無法從 Excel 標題列中找到有效的日期欄位');
      }

      excelLogger.debug('日期標題解析完成', {
        dateHeadersCount: dateHeaders.length,
        dateRange: this.extractDateRange(dateHeaders),
      });

      const normalizedRows = this.normalizePivotData(
        jsonData.slice(1),
        dateHeaders,
        workOrderNumber
      );

      if (normalizedRows.length === 0) {
        throw new Error('Excel 檔案中沒有有效的資料行');
      }

      excelLogger.info('道路施工部 Excel 解析完成', {
        workOrderNumber,
        totalRecords: normalizedRows.length,
        dateHeadersCount: dateHeaders.length,
      });

      return {
        workOrderNumber,
        totalRecords: normalizedRows.length,
        normalizedRows,
        dateRange: this.extractDateRange(dateHeaders),
      };
    } catch (error) {
      excelLogger.error('道路施工部 Excel 解析失敗', error, {
        fileName,
        filePath,
      });

      if (error instanceof Error) {
        if (
          error.message.includes('無法從檔名') ||
          error.message.includes('Excel 檔案') ||
          error.message.includes('無法從 Excel')
        ) {
          throw error;
        }

        if (
          error.message.includes('ENOENT') ||
          error.message.includes('no such file')
        ) {
          throw new Error(`檔案不存在: ${fileName}`);
        }
      }

      throw new Error(
        `道路施工部 Excel 檔案解析失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 從檔名提取派工單號
   */
  private static extractWorkOrderNumber(fileName: string): string {
    const match = fileName.match(/(\d{8})/);
    if (!match || !match[1]) {
      throw new Error(
        `無法從檔名 "${fileName}" 中提取派工單號。請確認檔名包含 8 位數字（例如：對帳工務所新生高架橋11409004.xlsx）`
      );
    }
    return match[1];
  }

  /**
   * 讀取 Excel 檔案
   */
  private static async readExcelFile(filePath: string): Promise<XLSX.WorkBook> {
    try {
      const fs = await import('fs/promises');
      const fileBuffer = await fs.readFile(filePath);
      return XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    } catch (error) {
      excelLogger.error('讀取 Excel 檔案失敗', error, { filePath });

      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(`檔案不存在: ${filePath}`);
      }

      throw new Error(
        `讀取 Excel 檔案失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 取得第一個工作表
   */
  private static getFirstWorksheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
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
   * 解析標題列，識別日期欄位
   */
  private static parseDateHeaders(headerRow: any[]): DateHeader[] {
    try {
      const dateHeaders = headerRow
        .map((header, index) => {
          if (!header) return null;

          if (header instanceof Date && !isNaN(header.getTime())) {
            return {
              columnIndex: index,
              originalText: header.toLocaleDateString(),
              date: header,
            };
          }

          const originalText = String(header).trim();
          if (this.isValidDateHeader(originalText)) {
            const date = this.parseDateString(originalText);
            if (date) {
              return { columnIndex: index, originalText, date };
            }
          }

          return null;
        })
        .filter((header): header is DateHeader => header !== null);

      if (dateHeaders.length === 0) {
        excelLogger.warn('標題列中沒有找到有效的日期欄位', {
          headerRow: headerRow.slice(0, 15),
          headerTypes: headerRow.slice(0, 15).map((h) => typeof h),
        });
      }

      return dateHeaders;
    } catch (error) {
      excelLogger.error('解析日期標題失敗', error);
      throw new Error(
        `解析 Excel 標題列失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 判斷是否為有效的日期標題（過濾空字串和統計欄位）
   */
  private static isValidDateHeader(header: string): boolean {
    return (
      header !== '' &&
      header !== '總計' &&
      header !== '合計' &&
      header !== '小計'
    );
  }

  /**
   * 將日期字串轉換為 Date 物件
   */
  private static parseDateString(dateStr: string): Date | null {
    try {
      const monthDayMatch = dateStr.match(/(\d+)月(\d+)日/);
      if (monthDayMatch && monthDayMatch[1] && monthDayMatch[2]) {
        return this.createDateFromMonthDay(
          parseInt(monthDayMatch[1]),
          parseInt(monthDayMatch[2])
        );
      }

      const slashMatch = dateStr.match(/(\d+)\/(\d+)/);
      if (slashMatch && slashMatch[1] && slashMatch[2]) {
        return this.createDateFromMonthDay(
          parseInt(slashMatch[1]),
          parseInt(slashMatch[2])
        );
      }

      const isoDate = new Date(dateStr);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }

      return null;
    } catch (error) {
      excelLogger.debug('日期字串解析失敗', {
        dateStr,
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      return null;
    }
  }

  /**
   * 從月日建立日期（預設當前年份）
   */
  private static createDateFromMonthDay(month: number, day: number): Date {
    try {
      const year = new Date().getFullYear();
      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
      ) {
        return date;
      }

      throw new Error(`無效的日期: ${month}月${day}日`);
    } catch (error) {
      excelLogger.debug('建立日期失敗', {
        month,
        day,
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      throw error;
    }
  }

  /**
   * 正規化樞紐表資料
   */
  private static normalizePivotData(
    dataRows: any[][],
    dateHeaders: DateHeader[],
    workOrderNumber: string
  ): RoadConstructionRow[] {
    try {
      const normalizedRows = dataRows
        .map((row) => this.extractItemName(row))
        .filter((itemName): itemName is string => itemName !== null)
        .flatMap((itemName) =>
          this.createRowsForItem(
            itemName,
            dataRows,
            dateHeaders,
            workOrderNumber
          )
        );

      excelLogger.debug('資料正規化完成', {
        totalRows: normalizedRows.length,
        uniqueItems: new Set(normalizedRows.map((r) => r.項目名稱)).size,
      });

      return normalizedRows;
    } catch (error) {
      excelLogger.error('資料正規化失敗', error);
      throw new Error(
        `正規化 Excel 資料失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 從資料列提取項目名稱
   */
  private static extractItemName(row: any[]): string | null {
    try {
      const itemName = String(row[0] || '').trim();
      return itemName !== '' ? itemName : null;
    } catch (error) {
      excelLogger.debug('提取項目名稱失敗', {
        row: row?.slice(0, 5),
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      return null;
    }
  }

  /**
   * 為特定項目建立多筆資料行（對應每個日期）
   */
  private static createRowsForItem(
    itemName: string,
    dataRows: any[][],
    dateHeaders: DateHeader[],
    workOrderNumber: string
  ): RoadConstructionRow[] {
    try {
      const itemRow = dataRows.find(
        (row) => String(row[0] || '').trim() === itemName
      );

      if (!itemRow) {
        excelLogger.warn('找不到對應的項目資料列', { itemName });
        return [];
      }

      return dateHeaders
        .map((dateHeader) =>
          this.createRowFromCell(itemName, itemRow, dateHeader, workOrderNumber)
        )
        .filter((row): row is RoadConstructionRow => row !== null);
    } catch (error) {
      excelLogger.error('建立項目資料行失敗', error, { itemName });
      return [];
    }
  }

  /**
   * 從單一儲存格建立資料行
   */
  private static createRowFromCell(
    itemName: string,
    itemRow: any[],
    dateHeader: DateHeader,
    workOrderNumber: string
  ): RoadConstructionRow | null {
    try {
      const value = itemRow[dateHeader.columnIndex];
      const numericValue = this.parseNumericValue(value);

      const dateString = dateHeader.date.toISOString().split('T')[0];

      return {
        派工單號: workOrderNumber,
        項目名稱: itemName,
        日期: dateString || '',
        數量金額: numericValue,
        備註: null,
      };
    } catch (error) {
      excelLogger.debug('建立資料行失敗', {
        itemName,
        date: dateHeader.originalText,
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      return null;
    }
  }

  /**
   * 解析數值（處理各種格式）
   */
  private static parseNumericValue(value: any): number {
    try {
      if (value === null || value === undefined || value === '') {
        return 0;
      }

      if (typeof value === 'number') {
        return isNaN(value) ? 0 : value;
      }

      const cleaned = String(value).trim().replace(/,/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    } catch (error) {
      excelLogger.debug('數值解析失敗', {
        value,
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      return 0;
    }
  }

  /**
   * 提取日期範圍
   */
  private static extractDateRange(dateHeaders: DateHeader[]): {
    start: string;
    end: string;
  } {
    try {
      if (dateHeaders.length === 0) {
        return { start: '', end: '' };
      }

      const dates = dateHeaders
        .map((h) => h.date)
        .sort((a, b) => a.getTime() - b.getTime());

      const firstDate = dates[0];
      const lastDate = dates[dates.length - 1];

      if (!firstDate || !lastDate) {
        return { start: '', end: '' };
      }

      return {
        start: firstDate.toISOString().split('T')[0] || '',
        end: lastDate.toISOString().split('T')[0] || '',
      };
    } catch (error) {
      excelLogger.warn('提取日期範圍失敗', {
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      return { start: '', end: '' };
    }
  }
}
