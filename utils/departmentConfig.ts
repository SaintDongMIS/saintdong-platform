/**
 * 前端部門驗證設定
 *
 * 用於在客戶端驗證 Excel 檔案格式，防止使用者上傳錯誤的檔案。
 */

/**
 * 驗證規則介面
 */
export interface DepartmentValidationConfig {
  /**
   * 必須包含的欄位
   * 如果檔案標頭缺少此陣列中的任何一個欄位，驗證將失敗。
   */
  requiredFields?: string[];

  /**
   * 禁止包含的欄位
   * 如果檔案標頭包含此陣列中的任何一個欄位，驗證將失敗。
   * 用於反向檢查，例如，道路施工部的檔案不應包含財務部的欄位。
   */
  forbiddenFields?: string[];
}

/**
 * 財務部門驗證設定
 * 檔案必須包含標準的財務報銷單欄位。
 */
export const financeValidationConfig: DepartmentValidationConfig = {
  requiredFields: ['表單編號', '申請人姓名', '表單本幣總計'],
};

/**
 * 道路施工部門驗證設定
 * 檔案格式為樞紐分析表，沒有固定標頭。
 * 驗證邏輯是檢查檔案是否'不'是財務部的檔案。
 * 如果檔案包含了財務部的特有欄位，則判定為錯誤檔案。
 */
export const roadConstructionValidationConfig: DepartmentValidationConfig = {
  forbiddenFields: ['表單編號', '申請人姓名', '表單本幣總計'],
};
