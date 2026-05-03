import { automationLogger } from '~/server/services/LoggerService';

const JOB = 'COMMEET_SYNC';

/** 正式環境（Docker / NODE_ENV=production）僅保留摘要；細項改 DEBUG */
export function isCommeetAutomationProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** 本地／非 production：INFO；production：DEBUG（預設 LOG_LEVEL 下不輸出） */
export function automationLogVerbose(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (isCommeetAutomationProd()) {
    automationLogger.debug(message, context);
  } else {
    automationLogger.info(message, context);
  }
}

/**
 * 外部 I/O：開發環境可見 io_start（verbose）；成功 io_complete（info）；失敗 io_complete（warn）。
 */
export async function withAutomationIoTiming<T>(
  operation: string,
  extra: Record<string, unknown> | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  const base = { job: JOB, operation, ...(extra ?? {}) };
  automationLogVerbose('io_start', base);

  try {
    const result = await fn();
    automationLogger.info('io_complete', {
      ...base,
      ok: true,
      ms: Date.now() - t0,
    });
    return result;
  } catch (error) {
    automationLogger.warn('io_complete', {
      ...base,
      ok: false,
      ms: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
