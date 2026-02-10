/**
 * 安全序列化物件，避免過長或循環引用導致爆掉
 * @param obj 任意物件（例如 Excel row）
 * @param maxLength 最大字元數，超過則截斷並加 "..."
 */
export function safeStringify(obj: any, maxLength = 500): string {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= maxLength) return s;
    return s.slice(0, maxLength) + '...';
  } catch {
    return '[無法序列化]';
  }
}
