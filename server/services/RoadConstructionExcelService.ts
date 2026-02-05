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
  廠商名稱: string;
  項目名稱: string;
  單位: string;
  單價: number;
  日期: string; // YYYY-MM-DD
  數量: number;
  備註: string | null;
  已更新: boolean;
}

/**
 * 道路施工部 Excel 資料介面
 */
export interface RoadConstructionExcelData {
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

      const workbook = await this.readExcelFile(filePath);
      const worksheet = this.getFirstWorksheet(workbook);

      // 使用 sheet_to_json 直接轉換為物件陣列
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        defval: null, // 將空值轉換為 null
      }) as any[];

      if (jsonData.length === 0) {
        throw new Error('Excel 檔案為空，沒有資料');
      }

      excelLogger.debug('Excel 資料讀取成功', {
        totalRows: jsonData.length,
      });

      const { normalizedRows, dateHeaders } = this.normalizePivotData(jsonData);

      if (normalizedRows.length === 0) {
        throw new Error('Excel 檔案中沒有有效的資料行');
      }

      excelLogger.info('道路施工部 Excel 解析完成', {
        totalRecords: normalizedRows.length,
        dateHeadersCount: dateHeaders.length,
      });

      return {
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
      // 支援 M/D/YY, MM/DD/YY, MM/DD/YYYY
      const dateParts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (dateParts && dateParts[1] && dateParts[2] && dateParts[3]) {
        const month = parseInt(dateParts[1], 10);
        const day = parseInt(dateParts[2], 10);
        let year = parseInt(dateParts[3], 10);

        // 處理兩位數年份
        if (year < 100) {
          year += 2000; // 假設為 21 世紀
        }

        const date = new Date(year, month - 1, day);
        // 驗證日期是否有效
        if (
          date.getFullYear() === year &&
          date.getMonth() === month - 1 &&
          date.getDate() === day
        ) {
          return date;
        }
      }

      // 支援 M月D日
      const monthDayMatch = dateStr.match(/(\d+)月(\d+)日/);
      if (monthDayMatch && monthDayMatch[1] && monthDayMatch[2]) {
        return this.createDateFromMonthDay(
          parseInt(monthDayMatch[1]),
          parseInt(monthDayMatch[2])
        );
      }

      // 嘗試直接解析 ISO 日期字串
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
  private static normalizePivotData(jsonData: any[]): {
    normalizedRows: RoadConstructionRow[];
    dateHeaders: DateHeader[];
  } {
    const normalizedRows: RoadConstructionRow[] = [];
    const dateHeaders: DateHeader[] = [];
    const dateHeaderMap = new Map<string, DateHeader>();

    for (const row of jsonData) {
      const workOrderNumber = String(row['派工單號'] || '').trim();
      const vendorName = String(row['廠商名稱'] || '').trim();
      const itemName = String(row['品名'] || '').trim();
      const unit = String(row['單位'] || '').trim();
      const unitPrice = this.parseNumericValue(row['單價']);

      // 派工單號和品名是必要欄位
      if (!workOrderNumber || !itemName) {
        continue;
      }

      for (let key in row) {
        const originalKey = key;
        if (
          !row.hasOwnProperty(originalKey) ||
          ['派工單號', '廠商名稱', '品名', '單位', '單價'].includes(originalKey)
        ) {
          continue;
        }

        const value = row[originalKey];
        const numericValue = this.parseNumericValue(value);

        // 如果沒有數值，則跳過
        if (numericValue === 0) {
          continue;
        }

        // 移除 xlsx 自動添加的後綴，例如 '10/13/25_1' -> '10/13/25'
        if (key.match(/_\d+$/)) {
          key = key.substring(0, key.lastIndexOf('_'));
        }

        const date = this.parseDateString(key);
        if (!date) {
          const message =
            originalKey && String(originalKey).trim()
              ? `欄位「${originalKey}」無法辨識為日期，但該欄含有數量，請補上對應日期後再上傳。`
              : '有欄位缺少日期標題但含有數量，請補上對應日期後再上傳。';
          throw new Error(message);
        }

        const dateString = date.toISOString().split('T')[0];

        // 處理重複日期欄位
        let dateHeader = dateHeaderMap.get(dateString!);
        if (!dateHeader) {
          dateHeader = {
            columnIndex: dateHeaders.length, // 虛擬索引
            originalText: originalKey,
            date,
          };
          dateHeaders.push(dateHeader);
          dateHeaderMap.set(dateString!, dateHeader);
        }

        // 檢查是否存在相同鍵的記錄，如果存在則加總
        const existingRow = normalizedRows.find(
          (r) =>
            r.派工單號 === workOrderNumber &&
            r.廠商名稱 === vendorName &&
            r.項目名稱 === itemName &&
            r.日期 === dateString!
        );

        if (existingRow) {
          existingRow.數量 += numericValue;
        } else {
          normalizedRows.push({
            派工單號: workOrderNumber,
            廠商名稱: vendorName,
            項目名稱: itemName,
            單位: unit,
            單價: unitPrice,
            日期: dateString!,
            數量: numericValue,
            備註: null,
            已更新: false,
          });
        }
      }
    }

    excelLogger.debug('資料正規化完成', {
      totalRows: normalizedRows.length,
      uniqueItems: new Set(normalizedRows.map((r) => r.項目名稱)).size,
    });

    return { normalizedRows, dateHeaders };
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
        start: firstDate.toISOString().split('T')[0]!,
        end: lastDate.toISOString().split('T')[0]!,
      };
    } catch (error) {
      excelLogger.warn('提取日期範圍失敗', {
        error: error instanceof Error ? error.message : '未知錯誤',
      });
      return { start: '', end: '' };
    }
  }
}
