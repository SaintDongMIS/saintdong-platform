import bankCodeMap from '../config/bankCodes.json';

export class DataEnrichmentService {
  /**
   * 根據銀行代號（前三碼）查詢銀行名稱
   * @param code 銀行代號
   * @returns 銀行名稱或 null
   */
  static getBankNameByCode(code: string | null | undefined): string | null {
    if (!code) {
      return null;
    }

    const formattedCode = code
      .toString()
      .substring(0, 3) as keyof typeof bankCodeMap;
    return bankCodeMap[formattedCode] || null;
  }
}
