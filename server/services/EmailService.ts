import nodemailer from 'nodemailer';
import { uploadLogger } from './LoggerService';

/**
 * Email 服務
 * 統一處理所有部門的上傳完成通知郵件
 */
export class EmailService {
  private static transporter: nodemailer.Transporter | null = null;

  /**
   * 取得 SMTP transporter（單例模式）
   */
  private static getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpPort = parseInt(process.env.SMTP_PORT || '25', 10);
    const isSecurePort = smtpPort === 465; // 465 使用 SSL
    const useTLS = smtpPort === 587; // 587 使用 STARTTLS

    const smtpConfig: any = {
      host: process.env.SMTP_HOST || 'sg2.bim-group.com',
      port: smtpPort,
      secure: isSecurePort, // 465 使用 SSL，其他不使用
      requireTLS: useTLS, // 587 使用 STARTTLS
      tls: {
        rejectUnauthorized: false, // 不驗證憑證（開發環境）
      },
      // 加上連線超時設定
      connectionTimeout: 10000, // 10 秒連線超時
      greetingTimeout: 10000, // 10 秒問候超時
      socketTimeout: 10000, // 10 秒 socket 超時
    };

    // 只有在設定了 SMTP_USER 時才加入認證資訊
    // 這允許使用無需認證的內部 SMTP Server (如 NAS 環境)
    if (process.env.SMTP_USER) {
      smtpConfig.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || '',
      };
    }

    uploadLogger.info('📧 EMAIL 設定：建立 SMTP transporter', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      authEnabled: !!smtpConfig.auth,
      user: smtpConfig.auth?.user,
    });

    // nodemailer 使用 'host' 作為配置參數名稱
    this.transporter = nodemailer.createTransport(smtpConfig);

    return this.transporter;
  }

  /**
   * 發送上傳完成通知郵件（統一介面）
   *
   * @param uploadResult - 上傳 API 的回應物件（兩個部門格式一致）
   */
  static async sendUploadNotification(uploadResult: {
    success: boolean;
    message: string;
    department?: string;
    data: {
      fileName: string;
      fileSize: number;
      uploadTime: string;
      excelStats?: {
        totalRows: number;
        validRows: number;
        skippedRows: number;
        headers?: string[];
      };
      databaseStats?: {
        tableName?: string;
        insertedCount: number;
        skippedCount: number;
        errorCount: number;
      };
      errors?: string[];
    };
  }): Promise<void> {
    const department = uploadResult.department || '未知部門';
    const fileName = uploadResult.data.fileName;

    // 檢查收件人設定（沒有就不發送）
    const recipient = process.env.EMAIL_TO;
    if (!recipient) {
      uploadLogger.warn('📧 EMAIL 通知：EMAIL_TO 未設定，跳過發送通知郵件', {
        department,
        fileName,
      });
      return;
    }

    // 處理多個收件人（支援逗號分隔）
    const recipients = recipient.split(',').map((email) => email.trim());

    uploadLogger.info('📧 EMAIL 通知：開始發送通知郵件', {
      department,
      fileName,
      recipients: recipients.join(', '),
      smtpHost: process.env.SMTP_HOST || 'sg2.bim-group.com',
      smtpPort: process.env.SMTP_PORT || '25',
    });

    try {
      const transporter = this.getTransporter();

      // 先測試連線（可選，但可以幫助診斷問題）
      uploadLogger.info('📧 EMAIL 測試：測試 SMTP 連線...');
      try {
        await transporter.verify();
        uploadLogger.info('📧 EMAIL 測試：SMTP 連線測試成功');
      } catch (verifyError: any) {
        uploadLogger.warn(
          '📧 EMAIL 測試：SMTP 連線測試失敗，但繼續嘗試發送',
          verifyError as Error
        );
      }

      // 發送郵件（加上超時保護）
      uploadLogger.info('📧 EMAIL 發送：正在發送郵件...');
      const sendPromise = transporter.sendMail({
        from: 'saintdong_platform@bim-group.com',
        to: recipients, // nodemailer 支援陣列
        subject: `[${department}] Excel 檔案上傳完成通知`,
        html: this.buildEmailContent(uploadResult),
        encoding: 'utf-8',
      });

      // 設定 30 秒超時
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('EMAIL 發送超時（30秒）')), 30000);
      });

      const mailResult = (await Promise.race([
        sendPromise,
        timeoutPromise,
      ])) as any;

      // ✅ 成功時用醒目的訊息
      uploadLogger.info('✅ EMAIL 通知：郵件發送成功！', {
        messageId: mailResult.messageId,
        response: mailResult.response,
        recipients: recipients.join(', '),
        department,
        fileName,
      });
    } catch (error) {
      // ❌ 失敗時用醒目的錯誤訊息，並顯示詳細錯誤
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      uploadLogger.error('❌ EMAIL 通知：郵件發送失敗！', error, {
        department,
        fileName,
        recipients: recipients.join(', '),
        errorMessage,
        errorStack,
        smtpHost: process.env.SMTP_HOST || 'sg2.bim-group.com',
        smtpPort: process.env.SMTP_PORT || '25',
        smtpUser: process.env.SMTP_USER || 'mailsystem',
        // 不記錄密碼
      });
    }
  }

  /**
   * 建立郵件 HTML 內容（統一格式，兩個部門共用）
   */
  private static buildEmailContent(uploadResult: {
    department?: string;
    data: {
      fileName: string;
      fileSize: number;
      uploadTime: string;
      excelStats?: {
        totalRows: number;
        validRows: number;
        skippedRows: number;
      };
      databaseStats?: {
        insertedCount: number;
        skippedCount: number;
        errorCount: number;
      };
      errors?: string[];
    };
  }): string {
    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
      return new Date(dateString).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    };

    const { data } = uploadResult;
    const department = uploadResult.department || '未知部門';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #374151; }
    .stats { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Excel 檔案上傳完成通知</h2>
    </div>
    <div class="content">
      <div class="info-row">
        <span class="label">部門：</span>${department}
      </div>
      <div class="info-row">
        <span class="label">檔案名稱：</span>${data.fileName}
      </div>
      <div class="info-row">
        <span class="label">檔案大小：</span>${formatFileSize(data.fileSize)}
      </div>
      <div class="info-row">
        <span class="label">上傳時間：</span>${formatDate(data.uploadTime)}
      </div>

      ${
        data.excelStats
          ? `
      <div class="stats">
        <h3>Excel 解析統計</h3>
        <div class="info-row">總行數：${data.excelStats.totalRows}</div>
        <div class="info-row success">有效行數：${data.excelStats.validRows}</div>
        <div class="info-row warning">跳過行數：${data.excelStats.skippedRows}</div>
      </div>
      `
          : ''
      }

      ${
        data.databaseStats
          ? `
      <div class="stats">
        <h3>資料庫操作統計</h3>
        <div class="info-row success">成功插入：${
          data.databaseStats.insertedCount
        } 筆</div>
        <div class="info-row warning">跳過（重複）：${
          data.databaseStats.skippedCount
        } 筆</div>
        <div class="info-row ${
          data.databaseStats.errorCount > 0 ? 'error' : 'success'
        }">
          錯誤數量：${data.databaseStats.errorCount} 筆
        </div>
      </div>
      `
          : ''
      }

      ${
        data.errors && data.errors.length > 0
          ? `
      <div class="stats" style="border-left-color: #ef4444;">
        <h3 style="color: #ef4444;">錯誤訊息</h3>
        <div style="max-height: 200px; overflow-y: auto;">
          ${data.errors
            .slice(0, 10)
            .map(
              (error, index) => `
            <div class="info-row" style="font-size: 12px; color: #6b7280;">
              ${index + 1}. ${error}
            </div>
          `
            )
            .join('')}
          ${
            data.errors.length > 10
              ? `<div class="info-row" style="font-size: 12px; color: #6b7280;">... 還有 ${
                  data.errors.length - 10
                } 個錯誤</div>`
              : ''
          }
        </div>
      </div>
      `
          : ''
      }
    </div>
    <div class="footer">
      <p>此為系統自動發送的通知郵件，請勿回覆。</p>
      <p>SaintDong Platform - 企業內部管理系統</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * 測試 SMTP 連接
   */
  static async testConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      uploadLogger.info('SMTP 連接測試成功');
      return true;
    } catch (error) {
      uploadLogger.error('SMTP 連接測試失敗', error);
      return false;
    }
  }
}
