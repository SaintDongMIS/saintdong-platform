/**
 * 業界標準的 Logger 服務
 * 提供結構化的日誌記錄功能
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogContext {
  service?: string;
  operation?: string;
  userId?: string;
  requestId?: string;
  [key: string]: any;
}

class LoggerService {
  private logLevel: LogLevel;

  constructor() {
    // 根據環境變數設定日誌等級
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase();
    this.logLevel =
      LogLevel[envLogLevel as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(
    level: string,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  private log(
    level: LogLevel,
    levelName: string,
    message: string,
    context?: LogContext
  ): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(levelName, message, context);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        break;
      case LogLevel.ERROR:
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...context,
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
    };
    this.log(LogLevel.ERROR, 'ERROR', message, errorContext);
  }

  // 便利方法：針對特定服務的日誌
  service(serviceName: string) {
    return {
      debug: (message: string, context?: Omit<LogContext, 'service'>) =>
        this.debug(message, { ...context, service: serviceName }),
      info: (message: string, context?: Omit<LogContext, 'service'>) =>
        this.info(message, { ...context, service: serviceName }),
      warn: (message: string, context?: Omit<LogContext, 'service'>) =>
        this.warn(message, { ...context, service: serviceName }),
      error: (
        message: string,
        error?: Error | any,
        context?: Omit<LogContext, 'service'>
      ) => this.error(message, error, { ...context, service: serviceName }),
    };
  }
}

// 匯出單例實例
export const logger = new LoggerService();

// 便利的服務特定 logger
export const apiLogger = logger.service('API');
export const dbLogger = logger.service('Database');
export const excelLogger = logger.service('Excel');
export const uploadLogger = logger.service('Upload');
