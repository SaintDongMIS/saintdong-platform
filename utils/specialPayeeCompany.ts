/**
 * 國泰整批轉檔：手續費分攤（13 內扣 / 15 外加）之特例戶名判斷（與後端 convertLine 一致）
 */

export const SPECIAL_PAYEE_MARKERS = [
  '台灣中油股份有限公司',
  '台灣中油',
  '雲一有限公司',
  '雲一有限',
] as const;

export function isSpecialPayeeCompany(payeeName: string): boolean {
  if (!payeeName) return false;
  return SPECIAL_PAYEE_MARKERS.some((m) => payeeName.includes(m));
}

export function handlingFeeAllocationForPayee(payeeName: string): {
  code: '13' | '15';
  labelZh: string;
} {
  return isSpecialPayeeCompany(payeeName)
    ? { code: '15', labelZh: '外加' }
    : { code: '13', labelZh: '內扣' };
}
