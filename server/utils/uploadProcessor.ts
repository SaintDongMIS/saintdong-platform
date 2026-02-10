import type { DepartmentConfig } from '../config/departmentConfig';
import { DatabaseService } from '../services/DatabaseService';
import { TableMigrationService } from '../services/TableMigrationService';
import { ExcelService } from '../services/ExcelService';
import { uploadLogger } from '../services/LoggerService';

/**
 * 上傳處理狀態
 */
interface UploadState {
  uploadedFile: Express.Multer.File;
  parsedData?: any;
  dbResult?: any;
}

/**
 * 通用上傳處理器
 * 根據部門配置執行完整的上傳流程
 */
export class UploadProcessor {
  /**
   * 處理上傳流程（通用版）
   */
  static async processUpload(
    uploadedFile: Express.Multer.File,
    config: DepartmentConfig
  ): Promise<any> {
    const state: UploadState = { uploadedFile };

    try {
      uploadLogger.info('開始處理上傳', {
        department: config.departmentName,
        fileName: uploadedFile.originalname,
        tableName: config.tableName,
      });

      // 1. 驗證資料庫連接
      await this.validateDatabaseConnection();

      // 2. 解析 Excel（使用部門專屬解析器）
      state.parsedData = await this.parseExcel(uploadedFile, config);

      // 3. 驗證資料
      await this.validateData(state.parsedData, config);

      // 4. 擴充資料（可選）
      if (config.dataEnricher) {
        await this.enrichData(state.parsedData, config.dataEnricher);
      }

      // 5. 確保資料表結構
      await this.ensureTableStructure(config);

      // 6. 插入資料庫
      state.dbResult = await this.insertToDatabase(state.parsedData, config);

      // 7. 建立回應
      return this.buildSuccessResponse(state, config);
    } catch (error) {
      uploadLogger.error('上傳處理失敗', error, {
        department: config.departmentName,
        tableName: config.tableName,
      });
      throw error;
    }
  }

  /**
   * 驗證資料庫連接
   */
  private static async validateDatabaseConnection(): Promise<void> {
    const dbConnected = await DatabaseService.testConnection();
    if (!dbConnected) {
      throw new Error('資料庫連接失敗');
    }
    uploadLogger.info('資料庫連接正常');
  }

  /**
   * 解析 Excel（使用部門專屬解析器）
   */
  private static async parseExcel(
    uploadedFile: Express.Multer.File,
    config: DepartmentConfig
  ): Promise<any> {
    uploadLogger.info('開始解析 Excel', {
      department: config.departmentName,
      fileName: uploadedFile.originalname,
    });

    const parsedData = await config.excelParser(
      uploadedFile.path,
      uploadedFile.originalname
    );

    uploadLogger.info('Excel 解析完成', {
      department: config.departmentName,
      totalRows: parsedData.totalRows,
      validRows: parsedData.validRows,
      skippedRows: parsedData.skippedRows,
    });

    return parsedData;
  }

  /**
   * 驗證資料
   */
  private static async validateData(
    parsedData: any,
    config: DepartmentConfig
  ): Promise<void> {
    // 財務部使用現有的驗證邏輯
    if (config.tableName === 'ExpendForm') {
      ExcelService.validateExcelData(parsedData, config.requiredFields);
    } else {
      // 道路施工部的驗證邏輯
      this.validateRoadConstructionData(parsedData, config);
    }

    uploadLogger.info('資料驗證通過', {
      department: config.departmentName,
    });
  }

  /**
   * 道路施工部專屬驗證
   */
  private static validateRoadConstructionData(
    parsedData: any,
    config: DepartmentConfig
  ): void {
    if (!parsedData.rows || parsedData.rows.length === 0) {
      throw new Error('Excel 檔案中沒有有效資料');
    }

    // 檢查必要欄位
    const firstRow = parsedData.rows[0];
    for (const field of config.requiredFields) {
      if (firstRow[field] === undefined || firstRow[field] === null) {
        // 允許 0 值，但不允許 undefined 或 null
        if (typeof firstRow[field] !== 'number' || firstRow[field] !== 0) {
          throw new Error(`缺少必要欄位: ${field}`);
        }
      }
    }

    // 檢查無未來日期：每筆 日期 必須 ≤ 今天，否則整批拒絕
    const today = new Date().toISOString().split('T')[0]!;
    for (const row of parsedData.rows) {
      const dateStr = row['日期'];
      if (dateStr && typeof dateStr === 'string' && dateStr > today) {
        throw new Error(
          `檔案內含未來日期（${dateStr}），請修正後再上傳。`
        );
      }
    }
  }

  /**
   * 擴充資料（可選步驟）
   */
  private static async enrichData(
    parsedData: any,
    enricher: (rows: any[]) => void
  ): Promise<void> {
    uploadLogger.info('開始擴充資料');
    enricher(parsedData.rows);
    uploadLogger.info('資料擴充完成');
  }

  /**
   * 確保資料表結構
   */
  private static async ensureTableStructure(
    config: DepartmentConfig
  ): Promise<void> {
    uploadLogger.info('檢查資料表結構', {
      department: config.departmentName,
      tableName: config.tableName,
    });

    await TableMigrationService.ensureTableStructure(
      config.tableName,
      config.tableSchema
    );

    uploadLogger.info('資料表結構檢查完成', {
      tableName: config.tableName,
    });
  }

  /**
   * 插入資料到資料庫
   */
  private static async insertToDatabase(
    parsedData: any,
    config: DepartmentConfig
  ): Promise<any> {
    uploadLogger.info('開始批次插入', {
      department: config.departmentName,
      tableName: config.tableName,
      recordCount: parsedData.rows.length,
    });

    // 根據資料表類型選擇不同的插入方法
    let dbResult: any;

    if (config.tableName === 'RoadConstructionForm') {
      // 道路施工部：使用專屬插入方法
      dbResult = await DatabaseService.batchInsertRoadConstructionData(
        parsedData.rows,
        config.tableName
      );
    } else {
      // 財務部：使用原有方法（保持不變）
      dbResult = await DatabaseService.batchInsertData(
        parsedData.rows,
        config.tableName
      );
    }

    if (!dbResult.success) {
      throw new Error(`資料庫操作失敗: ${dbResult.errors.join(', ')}`);
    }

    uploadLogger.info('資料庫操作完成', {
      department: config.departmentName,
      insertedCount: dbResult.insertedCount,
      skippedCount: dbResult.skippedCount,
    });

    return dbResult;
  }

  /**
   * 建立成功回應
   */
  private static buildSuccessResponse(
    state: UploadState,
    config: DepartmentConfig
  ): any {
    return {
      success: true,
      message: 'Excel 檔案處理完成',
      department: config.departmentName,
      data: {
        fileName: state.uploadedFile.originalname,
        fileSize: state.uploadedFile.size,
        uploadTime: new Date().toISOString(),
        excelStats: {
          totalRows: state.parsedData?.totalRows || 0,
          validRows: state.parsedData?.validRows || 0,
          skippedRows: state.parsedData?.skippedRows || 0,
          headers: state.parsedData?.headers,
        },
        databaseStats: {
          tableName: config.tableName,
          insertedCount: state.dbResult?.insertedCount || 0,
          skippedCount: state.dbResult?.skippedCount || 0,
          errorCount: state.dbResult?.errors?.length || 0,
        },
        errors: state.dbResult?.errors || [],
      },
    };
  }
}
