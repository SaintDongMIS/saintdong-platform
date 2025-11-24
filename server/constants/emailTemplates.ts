/**
 * Email 模板和工具函數
 */

export interface EmailData {
  success: boolean;
  message: string;
  department: string;
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
}

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 格式化日期時間
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 建立 Excel 統計區塊 HTML
 */
function buildExcelStatsSection(excelStats: EmailData['excelStats']): string {
  if (!excelStats) return '';

  return `
    <div class="stats">
      <h3>Excel 解析統計</h3>
      <div class="info-row">總行數：${excelStats.totalRows}</div>
      <div class="info-row success">有效行數：${excelStats.validRows}</div>
      <div class="info-row warning">跳過行數：${excelStats.skippedRows}</div>
    </div>
  `;
}

/**
 * 建立資料庫統計區塊 HTML
 */
function buildDatabaseStatsSection(
  databaseStats: EmailData['databaseStats']
): string {
  if (!databaseStats) return '';

  const errorClass = databaseStats.errorCount > 0 ? 'error' : 'success';
  return `
    <div class="stats">
      <h3>資料庫操作統計</h3>
      <div class="info-row success">成功插入：${databaseStats.insertedCount} 筆</div>
      <div class="info-row warning">跳過（重複）：${databaseStats.skippedCount} 筆</div>
      <div class="info-row ${errorClass}">錯誤數量：${databaseStats.errorCount} 筆</div>
    </div>
  `;
}

/**
 * 建立錯誤訊息區塊 HTML
 */
function buildErrorsSection(errors?: string[]): string {
  if (!errors || errors.length === 0) return '';

  const errorList = errors
    .slice(0, 10)
    .map(
      (error, index) => `
      <div class="info-row" style="font-size: 12px; color: #6b7280;">
        ${index + 1}. ${error}
      </div>
    `
    )
    .join('');

  const moreErrors =
    errors.length > 10
      ? `<div class="info-row" style="font-size: 12px; color: #6b7280;">... 還有 ${
          errors.length - 10
        } 個錯誤</div>`
      : '';

  return `
    <div class="stats" style="border-left-color: #ef4444;">
      <h3 style="color: #ef4444;">錯誤訊息</h3>
      <div style="max-height: 200px; overflow-y: auto;">
        ${errorList}
        ${moreErrors}
      </div>
    </div>
  `;
}

/**
 * 建立郵件 HTML 內容
 */
export function buildEmailHtml(data: EmailData): string {
  const isSuccess = data.success;
  const headerColor = isSuccess ? '#4F46E5' : '#ef4444';
  const headerTitle = isSuccess
    ? 'Excel 檔案上傳完成通知'
    : 'Excel 檔案上傳失敗通知';
  const statusBgColor = isSuccess ? '#d1fae5' : '#fee2e2';
  const statusTextColor = isSuccess ? '#065f46' : '#991b1b';
  const statusIcon = isSuccess ? '✅' : '❌';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${headerColor}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-row { margin: 10px 0; }
    .label { font-weight: bold; color: #374151; }
    .stats { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid ${headerColor}; }
    .success { color: #10b981; }
    .warning { color: #f59e0b; }
    .error { color: #ef4444; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
    .status-message { padding: 15px; margin: 15px 0; border-radius: 5px; background-color: ${statusBgColor}; color: ${statusTextColor}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${headerTitle}</h2>
    </div>
    <div class="content">
      <div class="status-message">
        <strong>${statusIcon} ${data.message}</strong>
      </div>
      <div class="info-row">
        <span class="label">部門：</span>${data.department}
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
      ${buildExcelStatsSection(data.excelStats)}
      ${buildDatabaseStatsSection(data.databaseStats)}
      ${buildErrorsSection(data.errors)}
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
