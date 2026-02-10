/**
 * 日期處理工具類
 * 
 * 解決 JavaScript Date.toISOString() 的 UTC 時區轉換問題
 * 
 * @example
 * ```typescript
 * // ❌ 錯誤：會有時區問題
 * const date = new Date('2026-01-15');
 * date.toISOString().split('T')[0]; // 可能返回 "2026-01-14"
 * 
 * // ✅ 正確：使用本地時區
 * DateHelper.toLocalDate(date); // 返回 "2026-01-15"
 * ```
 */
export class DateHelper {
  /**
   * 將 Date 物件轉換為本地時區的 YYYY-MM-DD 格式
   * 
   * 用途：
   * - 資料庫比對（複合鍵生成）
   * - Excel 日期轉換
   * - 日期範圍查詢
   * 
   * @param date Date 物件
   * @returns YYYY-MM-DD 格式的日期字串
   * 
   * @example
   * ```typescript
   * const date = new Date('2026-01-15T16:00:00.000Z'); // UTC
   * DateHelper.toLocalDate(date); // "2026-01-15" (台灣時區 UTC+8)
   * ```
   */
  static toLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 將 Date 物件轉換為本地時區的完整時間字串
   * 格式：YYYY-MM-DD HH:mm:ss
   * 
   * 用途：
   * - 資料庫記錄顯示
   * - 報表時間戳記
   * 
   * @param date Date 物件
   * @returns YYYY-MM-DD HH:mm:ss 格式的時間字串
   * 
   * @example
   * ```typescript
   * const date = new Date();
   * DateHelper.toLocalDateTime(date); // "2026-02-03 23:30:45"
   * ```
   */
  static toLocalDateTime(date: Date): string {
    const dateStr = this.toLocalDate(date);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${dateStr} ${hour}:${minute}:${second}`;
  }

  /**
   * 將 Date 物件轉換為 UTC ISO 8601 格式
   * 
   * 用途：
   * - API timestamp（遵循國際標準）
   * - 日誌記錄（統一時區）
   * - 跨時區資料交換
   * 
   * 注意：此方法使用 UTC 時區，不應用於業務邏輯的日期比對
   * 
   * @param date Date 物件
   * @returns ISO 8601 格式的 UTC 時間字串
   * 
   * @example
   * ```typescript
   * const date = new Date('2026-02-03 23:30:45');
   * DateHelper.toUTC(date); // "2026-02-03T15:30:45.000Z"
   * ```
   */
  static toUTC(date: Date): string {
    return date.toISOString();
  }

  /**
   * 將 Date 物件轉換為 UNIX timestamp（毫秒）
   * 
   * 用途：
   * - 資料庫儲存（最可靠的方式）
   * - 日期比較（數字比較更快）
   * - 跨時區資料同步
   * 
   * @param date Date 物件
   * @returns UNIX timestamp（毫秒）
   * 
   * @example
   * ```typescript
   * const date = new Date('2026-02-03');
   * DateHelper.toTimestamp(date); // 1770086400000
   * ```
   */
  static toTimestamp(date: Date): number {
    return date.getTime();
  }

  /**
   * 從 UNIX timestamp（毫秒）還原為 Date 物件
   * 
   * @param timestamp UNIX timestamp（毫秒）
   * @returns Date 物件
   * 
   * @example
   * ```typescript
   * const timestamp = 1770086400000;
   * DateHelper.fromTimestamp(timestamp); // Date 物件
   * ```
   */
  static fromTimestamp(timestamp: number): Date {
    return new Date(timestamp);
  }

  /**
   * 取得今天的日期（本地時區）
   * 
   * @returns YYYY-MM-DD 格式的今天日期
   * 
   * @example
   * ```typescript
   * DateHelper.today(); // "2026-02-03"
   * ```
   */
  static today(): string {
    return this.toLocalDate(new Date());
  }

  /**
   * 取得 N 天前的日期（本地時區）
   * 
   * @param days 天數
   * @returns YYYY-MM-DD 格式的日期
   * 
   * @example
   * ```typescript
   * DateHelper.daysAgo(7); // 7 天前的日期
   * ```
   */
  static daysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.toLocalDate(date);
  }

  /**
   * 取得 N 天後的日期（本地時區）
   * 
   * @param days 天數
   * @returns YYYY-MM-DD 格式的日期
   * 
   * @example
   * ```typescript
   * DateHelper.daysLater(30); // 30 天後的日期
   * ```
   */
  static daysLater(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return this.toLocalDate(date);
  }
}

/**
 * 便捷的具名導出（可選）
 */
export const {
  toLocalDate,
  toLocalDateTime,
  toUTC,
  toTimestamp,
  fromTimestamp,
  today,
  daysAgo,
  daysLater,
} = DateHelper;
