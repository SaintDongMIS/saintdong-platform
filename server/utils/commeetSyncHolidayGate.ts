import { TaiwanHoliday } from 'tw-holiday';
import { automationLogger } from '~/server/services/LoggerService';

let serverCacheConfigured = false;

function ensureTaiwanHolidayServerCache(): void {
  if (serverCacheConfigured) return;
  serverCacheConfigured = true;
  TaiwanHoliday.enabledCache = true;
  TaiwanHoliday.cacheTime = 24 * 60 * 60 * 1000;
}

function isTwHolidaySkipEnabled(): boolean {
  const raw = process.env.COMMEET_SYNC_SKIP_ON_TW_HOLIDAY;
  if (raw === undefined || raw === '') return true;
  return raw === 'true' || raw === '1';
}

export type CommeetSyncHolidayGateResult =
  | { proceed: true }
  | { proceed: false; localDate: string; message: string };

/**
 * 是否因台灣行政機關休假日而略過 COMMEET 同步（資料來源：tw-holiday → 新北開放資料）。
 * - 容器請維持 TZ=Asia/Taipei；傳入之日期須為該時區之 YYYY-MM-DD。
 * - tw-holiday 抛錯或無法判斷時改為仍執行同步（與排程穩定性權衡）。
 */
export async function evaluateCommeetSyncHolidayGate(input: {
  localDateYmd: string;
  skipHolidayCheck?: boolean;
}): Promise<CommeetSyncHolidayGateResult> {
  if (!isTwHolidaySkipEnabled() || input.skipHolidayCheck) {
    return { proceed: true };
  }

  ensureTaiwanHolidayServerCache();

  try {
    const isRestDay = await TaiwanHoliday.isHoliday(input.localDateYmd);
    if (!isRestDay) return { proceed: true };

    return {
      proceed: false,
      localDate: input.localDateYmd,
      message: `略過同步：${input.localDateYmd} 為行政機關行事曆之休假日`,
    };
  } catch (error) {
    automationLogger.warn('tw-holiday 判斷失敗，仍執行 COMMEET 同步', {
      localDateYmd: input.localDateYmd,
      error,
    });
    return { proceed: true };
  }
}
