import nodemailer from 'nodemailer';
import { uploadLogger } from './LoggerService';
import { buildEmailHtml } from '../constants/emailTemplates';
import type { EmailData } from '../constants/emailTemplates';

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
    const isSecurePort = smtpPort === 465;
    const useTLS = smtpPort === 587;

    const smtpConfig: any = {
      host: process.env.SMTP_HOST || 'sg2.bim-group.com',
      port: smtpPort,
      secure: isSecurePort,
      requireTLS: useTLS,
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    };

    if (process.env.SMTP_USER) {
      smtpConfig.auth = {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD || '',
      };
    }

    this.transporter = nodemailer.createTransport(smtpConfig);
    return this.transporter;
  }

  /**
   * 發送上傳通知郵件（成功或失敗都會發送）
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
    // 開發環境：可以透過環境變數關閉 email 功能
    const disableEmail =
      process.env.DISABLE_EMAIL === 'true' || process.env.DISABLE_EMAIL === '1';
    if (disableEmail) {
      uploadLogger.info('📧 EMAIL 功能已關閉（DISABLE_EMAIL=true）', {
        department: uploadResult.department,
        fileName: uploadResult.data.fileName,
      });
      return;
    }

    // 如果沒有設定收件人，也不發送
    const recipient = process.env.EMAIL_TO;
    if (!recipient) {
      uploadLogger.info('📧 EMAIL 功能已關閉（未設定 EMAIL_TO）', {
        department: uploadResult.department,
        fileName: uploadResult.data.fileName,
      });
      return;
    }

    const emailData = this.prepareEmailData(uploadResult);
    const emailConfig = this.prepareEmailConfig(emailData);

    try {
      const mailResult = await this.sendEmail(emailConfig);
      this.logEmailSuccess(mailResult, emailData);
    } catch (error) {
      this.logEmailError(error, emailData);
      throw error;
    }
  }

  /**
   * 準備郵件資料
   */
  private static prepareEmailData(uploadResult: {
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
      };
      databaseStats?: {
        insertedCount: number;
        skippedCount: number;
        errorCount: number;
      };
      errors?: string[];
    };
  }): EmailData {
    return {
      success: uploadResult.success,
      message: uploadResult.message,
      department: uploadResult.department || '未知部門',
      fileName: uploadResult.data.fileName,
      fileSize: uploadResult.data.fileSize,
      uploadTime: uploadResult.data.uploadTime,
      excelStats: uploadResult.data.excelStats,
      databaseStats: uploadResult.data.databaseStats,
      errors: uploadResult.data.errors,
    };
  }

  /**
   * 準備郵件配置
   */
  private static prepareEmailConfig(emailData: EmailData): {
    from: string;
    to: string[];
    subject: string;
    html: string;
  } {
    const recipient = process.env.EMAIL_TO!;
    const recipients = recipient.split(',').map((email) => email.trim());
    const smtpFrom = process.env.SMTP_FROM || 'mailsystem@mail.bim-group.com';
    const emailSubject = emailData.success
      ? `[${emailData.department}] Excel 檔案上傳完成通知`
      : `[${emailData.department}] Excel 檔案上傳失敗通知`;

    return {
      from: smtpFrom,
      to: recipients,
      subject: emailSubject,
      html: buildEmailHtml(emailData),
    };
  }

  /**
   * 發送郵件（含超時保護）
   */
  private static async sendEmail(config: {
    from: string;
    to: string[];
    subject: string;
    html: string;
  }): Promise<any> {
    const transporter = this.getTransporter();

    return Promise.race([
      transporter.sendMail({
        ...config,
        encoding: 'utf-8',
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('EMAIL 發送超時（30秒）')), 30000)
      ),
    ]);
  }

  /**
   * 記錄郵件發送成功
   */
  private static logEmailSuccess(mailResult: any, emailData: EmailData): void {
    uploadLogger.info('✅ EMAIL 通知：郵件發送成功', {
      messageId: mailResult.messageId,
      department: emailData.department,
      fileName: emailData.fileName,
      success: emailData.success,
    });
  }

  /**
   * 記錄郵件發送失敗
   */
  private static logEmailError(error: any, emailData: EmailData): void {
    uploadLogger.error('❌ EMAIL 通知：郵件發送失敗', error, {
      department: emailData.department,
      fileName: emailData.fileName,
    });
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
