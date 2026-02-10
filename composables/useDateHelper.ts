/**
 * 前端日期處理 Composable
 * 
 * 解決 JavaScript Date.toISOString() 的 UTC 時區轉換問題
 * 
 * @example
 * ```vue
 * <script setup>
 * const { toLocalDate, today, daysAgo } = useDateHelper();
 * 
 * const startDate = daysAgo(7);
 * const endDate = today();
 * </script>
 * ```
 */
export const useDateHelper = () => {
  /**
   * 將 Date 物件轉換為本地時區的 YYYY-MM-DD 格式
   * 
   * @param date Date 物件
   * @returns YYYY-MM-DD 格式的日期字串
   */
  const toLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  /**
   * 將 Date 物件轉換為本地時區的完整時間字串
   * 格式：YYYY-MM-DD HH:mm:ss
   * 
   * @param date Date 物件
   * @returns YYYY-MM-DD HH:mm:ss 格式的時間字串
   */
  const toLocalDateTime = (date: Date): string => {
    const dateStr = toLocalDate(date);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    return `${dateStr} ${hour}:${minute}:${second}`;
  };

  /**
   * 將 Date 物件轉換為 UTC ISO 8601 格式
   * 
   * @param date Date 物件
   * @returns ISO 8601 格式的 UTC 時間字串
   */
  const toUTC = (date: Date): string => {
    return date.toISOString();
  };

  /**
   * 取得今天的日期（本地時區）
   * 
   * @returns YYYY-MM-DD 格式的今天日期
   */
  const today = (): string => {
    return toLocalDate(new Date());
  };

  /**
   * 取得 N 天前的日期（本地時區）
   * 
   * @param days 天數
   * @returns YYYY-MM-DD 格式的日期
   */
  const daysAgo = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return toLocalDate(date);
  };

  /**
   * 取得 N 天後的日期（本地時區）
   * 
   * @param days 天數
   * @returns YYYY-MM-DD 格式的日期
   */
  const daysLater = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toLocalDate(date);
  };

  /**
   * 取得本月第一天
   * 
   * @returns YYYY-MM-DD 格式的日期
   */
  const firstDayOfMonth = (): string => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    return toLocalDate(firstDay);
  };

  /**
   * 取得本月最後一天
   * 
   * @returns YYYY-MM-DD 格式的日期
   */
  const lastDayOfMonth = (): string => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return toLocalDate(lastDay);
  };

  /**
   * 格式化顯示用的日期字串
   * 使用 Intl.DateTimeFormat（支援多語系）
   * 
   * @param date Date 物件或日期字串
   * @param locale 語系（預設：zh-TW）
   * @returns 格式化的日期字串
   */
  const formatDisplay = (date: Date | string, locale: string = 'zh-TW'): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateObj);
  };

  return {
    toLocalDate,
    toLocalDateTime,
    toUTC,
    today,
    daysAgo,
    daysLater,
    firstDayOfMonth,
    lastDayOfMonth,
    formatDisplay,
  };
};
