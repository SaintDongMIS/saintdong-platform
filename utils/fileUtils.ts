import { FILE_SIZE_UNITS, FILE_SIZE_BASE } from '~/constants/fileUpload';

/**
 * 格式化檔案大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const i = Math.floor(Math.log(bytes) / Math.log(FILE_SIZE_BASE));
  return (
    parseFloat((bytes / Math.pow(FILE_SIZE_BASE, i)).toFixed(2)) +
    ' ' +
    FILE_SIZE_UNITS[i]
  );
}

/**
 * 從 Content-Disposition header 提取檔名
 */
export function extractFilenameFromHeader(
  contentDisposition: string | null,
  defaultFilename: string
): string {
  if (!contentDisposition) return defaultFilename;

  const filenameMatch = contentDisposition.match(
    /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
  );
  
  if (filenameMatch && filenameMatch[1]) {
    return decodeURIComponent(filenameMatch[1].replace(/['"]/g, ''));
  }
  
  return defaultFilename;
}

/**
 * 下載 Blob 檔案
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
