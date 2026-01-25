<template>
  <div class="bg-white rounded-lg shadow-sm border p-6">
    <div class="text-center mb-8">
      <div
        class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <svg
          class="w-8 h-8 text-purple-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          ></path>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        付款報表事由填補
      </h2>
      <p class="text-gray-600">
        上傳付款報表 Excel 檔案，系統將自動從資料庫填補「事由」欄位
      </p>
    </div>

    <FileUploadZone
      :selected-file="upload.selectedFile.value"
      :is-drag-over="upload.isDragOver.value"
      accept=".xlsx,.xls"
      accept-text="支援 .xlsx, .xls 檔案"
      color="purple"
      input-ref="fillPaymentReasonFileInput"
      @dragover="upload.isDragOver.value = true"
      @dragleave="upload.isDragOver.value = false"
      @drop="upload.handleFileDrop"
      @click="triggerFileInput"
      @change="upload.handleFileSelect"
      @clear="upload.clearFile"
    />

    <button
      @click="handleFillReason"
      :disabled="!upload.selectedFile.value || upload.isProcessing.value"
      class="w-full mt-4 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
    >
      <span
        v-if="upload.isProcessing.value"
        class="flex items-center justify-center"
      >
        <svg
          class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        處理中...
      </span>
      <span v-else>填補事由</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useFileUpload } from '~/composables/useFileUpload';
import { useToast } from '~/composables/useToast';
import { ALLOWED_EXCEL_ONLY, TOAST_DELAY_MS, TOAST_DURATION_MS } from '~/constants/fileUpload';
import { downloadBlob, extractFilenameFromHeader } from '~/utils/fileUtils';

const { success, error, warning } = useToast();

const upload = useFileUpload({
  allowedExtensions: ALLOWED_EXCEL_ONLY,
  onValidate: async (file: File) => {
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf('.'));
    
    if (!ALLOWED_EXCEL_ONLY.includes(fileExtension)) {
      warning('請選擇 Excel 檔案 (.xlsx, .xls)');
      return false;
    }
    return true;
  },
});

const triggerFileInput = () => {
  if (typeof document !== 'undefined') {
    const input = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    if (input) input.click();
  }
};

const handleFillReason = async () => {
  if (!upload.selectedFile.value) return;

  upload.isProcessing.value = true;

  try {
    const formData = new FormData();
    formData.append('file', upload.selectedFile.value);

    const response = await fetch('/api/finance/fill-payment-reason', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || '處理失敗');
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error('處理後的檔案為空，請檢查輸入檔案格式是否正確');
    }

    const filename = extractFilenameFromHeader(
      response.headers.get('Content-Disposition'),
      '付款報表_已填補事由.xlsx'
    );

    downloadBlob(blob, filename);

    // 延遲顯示成功訊息，確保下載對話框不會遮擋 Toast
    setTimeout(() => {
      success('✅ 事由填補完成！檔案已下載', TOAST_DURATION_MS);
      upload.clearFile();
    }, TOAST_DELAY_MS);
  } catch (err) {
    console.error('處理失敗:', err);
    const errorMessage =
      err instanceof Error ? err.message : '處理失敗，請稍後再試';
    error(errorMessage);
  } finally {
    upload.isProcessing.value = false;
  }
};
</script>
