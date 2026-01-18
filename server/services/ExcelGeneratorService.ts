import * as XLSX from 'xlsx';
import { ExcelService, type ProcessedExcelData } from './ExcelService';
import { excelLogger } from './LoggerService';

export class ExcelGeneratorService {
  /**
   * 處理 Excel 檔案並生成新的 Excel 檔案
   */
  static async processExcelFile(filePath: string): Promise<Buffer> {
    try {
      excelLogger.info('開始處理 Excel 檔案', { filePath });

      // 1. 解析 Excel 檔案
      const processedData = await ExcelService.parseExcel(filePath);

      // 2. 擴充銀行資料
      ExcelService.enrichBankData(processedData.rows);

      // 3. 生成新的 Excel 檔案
      const newExcelBuffer = await this.generateExcelBuffer(processedData);

      excelLogger.info('Excel 檔案處理完成', {
        totalRows: processedData.totalRows,
        validRows: processedData.validRows,
        skippedRows: processedData.skippedRows,
      });

      return newExcelBuffer;
    } catch (error) {
      excelLogger.error('Excel 檔案處理失敗', error);
      throw new Error(
        `Excel 檔案處理失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 生成 Excel 檔案 Buffer
   */
  public static async generateExcelBuffer(
    processedData: ProcessedExcelData
  ): Promise<Buffer> {
    try {
      // 建立工作簿
      const workbook = XLSX.utils.book_new();

      // 準備資料 - 將物件陣列轉換為二維陣列
      const worksheetData = [
        processedData.headers, // 標題行
        ...processedData.rows.map((row) =>
          processedData.headers.map((header) => row[header] || '')
        ),
      ];

      // 建立工作表
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // 設定欄位寬度
      const columnWidths = this.calculateColumnWidths(
        processedData.headers,
        worksheetData
      );
      worksheet['!cols'] = columnWidths;

      // 將工作表加入工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, '處理後資料');

      // 生成 Buffer
      const excelBuffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx',
        compression: true,
      });

      return excelBuffer;
    } catch (error) {
      excelLogger.error('生成 Excel Buffer 失敗', error);
      throw new Error(
        `生成 Excel 檔案失敗: ${
          error instanceof Error ? error.message : '未知錯誤'
        }`
      );
    }
  }

  /**
   * 計算欄位寬度
   */
  private static calculateColumnWidths(
    headers: string[],
    data: any[][]
  ): Array<{ wch: number }> {
    return headers.map((header, index) => {
      // 計算該欄位的最大寬度
      const maxLength = Math.max(
        header.length,
        ...data
          .slice(1)
          .map((row) => (row[index] ? String(row[index]).length : 0))
      );

      // 設定最小寬度 10，最大寬度 50
      return {
        wch: Math.min(Math.max(maxLength + 2, 10), 50),
      };
    });
  }

  /**
   * 生成檔案名稱（使用台灣時間）
   */
  static generateFileName(originalName: string): string {
    const now = new Date();
    // 轉換為台灣時間（UTC+8）
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    
    const year = taiwanTime.getUTCFullYear();
    const month = String(taiwanTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(taiwanTime.getUTCDate()).padStart(2, '0');
    const hour = String(taiwanTime.getUTCHours()).padStart(2, '0');
    const minute = String(taiwanTime.getUTCMinutes()).padStart(2, '0');
    const second = String(taiwanTime.getUTCSeconds()).padStart(2, '0');
    
    const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`;
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_處理後_${timestamp}.xlsx`;
  }

  /**
   * 清理暫存檔案
   */
  static async cleanupFile(filePath: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.unlink(filePath);
      excelLogger.info(`已清理暫存檔案: ${filePath}`);
    } catch (error) {
      excelLogger.error('清理檔案失敗', error);
    }
  }
}
