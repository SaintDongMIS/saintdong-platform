import {
  reimbursementTableSchema,
  roadConstructionTableSchema,
} from '../services/TableDefinitionService';
import { ExcelService } from '../services/ExcelService';
import { RoadConstructionExcelService } from '../services/RoadConstructionExcelService';

/**
 * Excel 解析結果介面
 */
export interface ExcelParseResult {
  rows: any[];
  totalRows: number;
  validRows: number;
  skippedRows: number;
  headers?: string[];
}

/**
 * Excel 解析函數類型
 */
export type ExcelParser = (
  filePath: string,
  fileName: string
) => Promise<ExcelParseResult>;

/**
 * 資料擴充函數類型
 */
export type DataEnricher = (rows: any[]) => void;

/**
 * 部門配置介面
 */
export interface DepartmentConfig {
  /** 部門名稱 */
  departmentName: string;
  /** 資料表名稱 */
  tableName: string;
  /** 必要欄位（用於驗證） */
  requiredFields: string[];
  /** 資料表 Schema */
  tableSchema: string;
  /** 主鍵欄位名稱（用於排除插入） */
  primaryKeyField: string;
  /** Excel 解析器 */
  excelParser: ExcelParser;
  /** 資料擴充函數（可選） */
  dataEnricher?: DataEnricher;
}

/**
 * 財務部門配置
 *
 * 完全重用現有服務，不修改任何邏輯
 * 確保財務部功能完全不受影響
 */
export const FinanceDepartmentConfig: DepartmentConfig = {
  departmentName: '財務部門',
  tableName: 'ExpendForm',
  requiredFields: ['表單編號', '申請人姓名', '表單本幣總計'],
  tableSchema: reimbursementTableSchema,
  primaryKeyField: 'EFid',

  /**
   * Excel 解析器（重用現有的 ExcelService）
   */
  excelParser: async (filePath: string, fileName: string) => {
    // ✅ 完全使用現有的 ExcelService，保持原有邏輯
    const excelData = await ExcelService.parseExcel(filePath);
    return {
      rows: excelData.rows,
      totalRows: excelData.totalRows,
      validRows: excelData.validRows,
      skippedRows: excelData.skippedRows,
      headers: excelData.headers,
    };
  },

  /**
   * 資料擴充函數（重用現有的銀行資料擴充）
   */
  dataEnricher: ExcelService.enrichBankData,
};

/**
 * 道路施工部門配置
 */
export const RoadConstructionDepartmentConfig: DepartmentConfig = {
  departmentName: '道路施工部門',
  tableName: 'RoadConstructionForm',
  requiredFields: ['派工單號', '項目名稱', '日期', '數量'],
  tableSchema: roadConstructionTableSchema,
  primaryKeyField: 'RCid',

  /**
   * Excel 解析器（使用專屬解析器）
   */
  excelParser: async (filePath: string, fileName: string) => {
    const excelData = await RoadConstructionExcelService.parsePivotTableExcel(
      filePath,
      fileName
    );
    return {
      rows: excelData.normalizedRows,
      totalRows: excelData.totalRecords,
      validRows: excelData.totalRecords,
      skippedRows: 0,
    };
  },

  // 道路施工部不需要資料擴充
};

/**
 * 部門配置映射（方便查詢）
 */
export const DepartmentConfigs = {
  finance: FinanceDepartmentConfig,
  'road-construction': RoadConstructionDepartmentConfig,
} as const;

/**
 * 根據 API 路由取得部門配置
 */
export function getDepartmentConfigByRoute(
  route: string
): DepartmentConfig | null {
  if (route.includes('finance')) {
    return FinanceDepartmentConfig;
  }
  if (route.includes('road-construction')) {
    return RoadConstructionDepartmentConfig;
  }
  return null;
}
