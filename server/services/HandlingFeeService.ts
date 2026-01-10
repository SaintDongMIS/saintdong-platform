/**
 * 手續費計算服務
 * 負責計算臨櫃匯款手續費，並處理特例公司
 */

export interface HandlingFeeResult {
  fee: number; // 手續費金額
  allocationMethod: '15' | '13'; // 15=外加, 13=內扣
  finalAmount: number; // 最終金額（考慮手續費後）
}

/**
 * 特例公司列表（手續費30元，外加）
 */
const SPECIAL_COMPANIES = [
  '台灣中油股份有限公司',
  '雲一有限公司',
];

/**
 * 判斷是否為特例公司
 */
export function isSpecialCompany(payeeName: string): boolean {
  if (!payeeName) return false;
  return SPECIAL_COMPANIES.some((company) => payeeName.includes(company));
}

/**
 * 計算一般手續費（臨櫃匯款）
 * 規則：
 * - 200萬以下：約30元
 * - 超過200萬：每增加100萬加收約10元
 */
function calculateStandardFee(amount: number): number {
  const TWO_MILLION = 2000000;
  const BASE_FEE = 30;
  const ADDITIONAL_FEE_PER_MILLION = 10;

  if (amount <= TWO_MILLION) {
    return BASE_FEE;
  }

  // 超過200萬的部分
  const excess = amount - TWO_MILLION;
  // 每100萬加收10元，向上取整
  const additionalMillions = Math.ceil(excess / 1000000);
  const additionalFee = additionalMillions * ADDITIONAL_FEE_PER_MILLION;

  return BASE_FEE + additionalFee;
}

/**
 * 計算手續費
 * @param amount 匯款金額
 * @param payeeName 收款人戶名
 * @returns 手續費計算結果
 */
export function calculateHandlingFee(
  amount: number,
  payeeName: string
): HandlingFeeResult {
  // 判斷是否為特例公司
  const isSpecial = isSpecialCompany(payeeName);

  let fee: number;
  let allocationMethod: '15' | '13';

  if (isSpecial) {
    // 特例公司：30元外加
    fee = 30;
    allocationMethod = '15'; // 外加
  } else {
    // 一般情況：根據金額計算手續費
    fee = calculateStandardFee(amount);
    // 臨櫃匯款手續費通常為外加
    allocationMethod = '15'; // 外加
  }

  // 計算最終金額
  let finalAmount: number;
  if (allocationMethod === '15') {
    // 外加：最終金額 = 原金額 + 手續費
    finalAmount = amount + fee;
  } else {
    // 內扣：最終金額 = 原金額 - 手續費
    finalAmount = amount - fee;
  }

  return {
    fee,
    allocationMethod,
    finalAmount,
  };
}

