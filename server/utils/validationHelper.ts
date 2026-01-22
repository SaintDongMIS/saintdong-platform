/**
 * 資料驗證輔助函數
 * 防止特殊符號、SQL 注入、XSS 攻擊
 */

/**
 * 清理字串：只保留中文、英文、數字、常用標點符號
 */
export function sanitizeString(input: any, maxLength = 200): string {
  if (!input || typeof input !== 'string') return '';
  
  // 移除危險字元，保留中文、英文、數字、空白、常用標點
  const cleaned = input
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\.\-\(\)\/<>]/g, '')
    .substring(0, maxLength);
  
  return cleaned;
}

/**
 * 驗證並清理數字
 */
export function sanitizeNumber(input: any, options: {
  min?: number;
  max?: number;
  decimals?: number;
} = {}): number {
  const { min = 0, max = 999999999, decimals = 2 } = options;
  
  let num: number;
  
  if (typeof input === 'number') {
    num = input;
  } else if (typeof input === 'string') {
    // 移除千分位符號
    const cleaned = input.replace(/,/g, '');
    num = parseFloat(cleaned);
  } else {
    return 0;
  }
  
  // 檢查是否為有效數字
  if (isNaN(num) || !isFinite(num)) {
    return 0;
  }
  
  // 限制範圍
  num = Math.max(min, Math.min(max, num));
  
  // 限制小數位數
  const factor = Math.pow(10, decimals);
  num = Math.round(num * factor) / factor;
  
  return num;
}

/**
 * 驗證單位（白名單）
 */
export function validateUnit(unit: string): boolean {
  const allowedUnits = ['天', '頓', '台', '小時', '桶', '噸', '公尺', '平方公尺', '立方公尺', '個', '組', '式'];
  return allowedUnits.includes(unit.trim());
}

/**
 * 驗證項目名稱
 */
export function validateItemName(name: string): { valid: boolean; message?: string } {
  if (!name || name.trim().length === 0) {
    return { valid: false, message: '項目名稱不可為空' };
  }
  
  if (name.length > 100) {
    return { valid: false, message: '項目名稱長度不可超過 100 字元' };
  }
  
  // 檢查是否包含危險字元
  const dangerousChars = ['<', '>', '"', "'", ';', '--', '/*', '*/', 'script'];
  const lowerName = name.toLowerCase();
  
  for (const char of dangerousChars) {
    if (lowerName.includes(char)) {
      return { valid: false, message: '項目名稱包含不允許的字元' };
    }
  }
  
  return { valid: true };
}

/**
 * 驗證數量
 */
export function validateQuantity(quantity: any): { valid: boolean; value?: number; message?: string } {
  const num = sanitizeNumber(quantity, {
    min: 0,
    max: 999999,
    decimals: 2,
  });
  
  if (num < 0) {
    return { valid: false, message: '數量不可為負數' };
  }
  
  if (num > 999999) {
    return { valid: false, message: '數量超過上限（999,999）' };
  }
  
  return { valid: true, value: num };
}

/**
 * 驗證單價
 */
export function validatePrice(price: any): { valid: boolean; value?: number; message?: string } {
  const num = sanitizeNumber(price, {
    min: 0,
    max: 9999999,
    decimals: 2,
  });
  
  if (num < 0) {
    return { valid: false, message: '單價不可為負數' };
  }
  
  if (num > 9999999) {
    return { valid: false, message: '單價超過上限（9,999,999）' };
  }
  
  return { valid: true, value: num };
}

/**
 * 驗證日期格式
 */
export function validateDate(dateString: string): { valid: boolean; message?: string } {
  if (!dateString) {
    return { valid: false, message: '日期不可為空' };
  }
  
  // 轉換日期字串：如果是 ISO 8601 格式（包含 T），先轉換為 YYYY-MM-DD
  let cleanedDate = String(dateString);
  if (cleanedDate.includes('T')) {
    cleanedDate = cleanedDate.split('T')[0] || cleanedDate;
  }
  
  // 驗證日期格式 YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(cleanedDate)) {
    return { valid: false, message: '日期格式錯誤（應為 YYYY-MM-DD）' };
  }
  
  const date = new Date(cleanedDate);
  if (isNaN(date.getTime())) {
    return { valid: false, message: '無效的日期' };
  }
  
  // 檢查日期範圍（2020-2050）
  const year = date.getFullYear();
  if (year < 2020 || year > 2050) {
    return { valid: false, message: '日期超出合理範圍（2020-2050）' };
  }
  
  return { valid: true };
}
