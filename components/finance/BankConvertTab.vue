<template>
  <div class="bg-white rounded-lg shadow-sm border p-6">
    <div class="text-center mb-8">
      <div
        class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <svg
          class="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          ></path>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        網銀付款txt轉檔
      </h2>
      <p class="text-gray-600">
        上傳commeet網銀付款匯出檔案，轉換為國泰銀行整批付款格式
      </p>
    </div>

    <FileUploadZone
      :selected-file="upload.selectedFile.value"
      :is-drag-over="upload.isDragOver.value"
      accept=".txt"
      accept-text="支援 .txt 檔案"
      color="green"
      input-ref="bankConvertFileInput"
      @dragover="upload.isDragOver.value = true"
      @dragleave="upload.isDragOver.value = false"
      @drop="upload.handleFileDrop"
      @click="triggerFileInput"
      @change="upload.handleFileSelect"
      @clear="upload.clearFile"
    />

    <button
      @click="handleConvert"
      :disabled="!upload.selectedFile.value || upload.isProcessing.value"
      class="w-full mt-4 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
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
        轉換中...
      </span>
      <span v-else>轉換檔案</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useFileUpload } from '~/composables/useFileUpload';
import { useToast } from '~/composables/useToast';
import { ALLOWED_TXT_EXTENSIONS } from '~/constants/fileUpload';
import { downloadBlob, extractFilenameFromHeader } from '~/utils/fileUtils';

const { success, error, warning } = useToast();

const upload = useFileUpload({
  allowedExtensions: ALLOWED_TXT_EXTENSIONS,
  onValidate: async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.txt')) {
      warning('請選擇 .txt 檔案');
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

const handleConvert = async () => {
  if (!upload.selectedFile.value) return;

  upload.isProcessing.value = true;

  try {
    const formData = new FormData();
    formData.append('file', upload.selectedFile.value);

    const response = await fetch('/api/bank-convert', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('轉換失敗');
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error('轉換後的檔案為空，請檢查輸入檔案格式是否正確');
    }

    const filename = extractFilenameFromHeader(
      response.headers.get('Content-Disposition'),
      'commeet整批付款.txt'
    );

    downloadBlob(blob, filename);

    success('轉換完成！檔案已下載');
    upload.clearFile();
  } catch (err) {
    console.error('轉換失敗:', err);
    error('轉換失敗，請稍後再試');
  } finally {
    upload.isProcessing.value = false;
  }
};
</script>
