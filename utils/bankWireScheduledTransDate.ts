const TAIPEI_TZ = 'Asia/Taipei';

export type TaipeiCalendarParts = {
  year: number;
  month: number;
  day: number;
};

export type TaipeiDateTimeParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
};

function taipeiPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): string {
  const value = parts.find((p) => p.type === type)?.value;
  if (value == null || value === '') {
    throw new Error(`無法解析台北時間：${type}`);
  }
  return value;
}

/** 操作當下之台北年月日時分秒（批次 ID、下載檔名等） */
export function getTaipeiDateTimeParts(
  now: Date = new Date()
): TaipeiDateTimeParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(now);
  return {
    year: taipeiPart(parts, 'year'),
    month: taipeiPart(parts, 'month'),
    day: taipeiPart(parts, 'day'),
    hour: taipeiPart(parts, 'hour'),
    minute: taipeiPart(parts, 'minute'),
    second: taipeiPart(parts, 'second'),
  };
}

/** 操作當下之台北曆法年月日（預定交易日期等） */
export function getTaipeiCalendarParts(now: Date = new Date()): TaipeiCalendarParts {
  const { year, month, day } = getTaipeiDateTimeParts(now);
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    throw new Error('無法解析台北日期');
  }
  return { year: y, month: m, day: d };
}

/** 曆法月（1–12）之最後一日；閏年由 Date 內建規則處理 */
export function lastDayOfCalendarMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * 國泰整批付款「預定交易日期」YYYYMMDD（台北操作日）：
 * - 當月 1～14 日 → 當月 15 日
 * - 當月 15 日～月底 → 當月最後一日
 */
export function getScheduledTransDateYmd(now: Date = new Date()): string {
  const { year, month, day } = getTaipeiCalendarParts(now);
  const yy = String(year);
  const mm = String(month).padStart(2, '0');

  if (day < 15) {
    return `${yy}${mm}15`;
  }

  const dd = String(lastDayOfCalendarMonth(year, month)).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}
