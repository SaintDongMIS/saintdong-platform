<template>
  <div class="bg-white rounded-lg shadow-sm border p-6">
    <div class="text-center mb-8">
      <div
        class="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <svg
          class="w-8 h-8 text-orange-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          ></path>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">
        Excel 檔案上傳系統
      </h2>
      <p class="text-gray-600">上傳道路施工 Excel 檔案</p>
    </div>

    <FileUploadZone
      :selected-file="upload.selectedFile.value"
      :is-drag-over="upload.isDragOver.value"
      accept=".xlsx,.xls,.csv"
      accept-text="支援 .xlsx, .xls, .csv 格式"
      color="orange"
      input-ref="fileInput"
      @dragover="upload.isDragOver.value = true"
      @dragleave="upload.isDragOver.value = false"
      @drop="upload.handleFileDrop"
      @click="triggerFileInput"
      @change="upload.handleFileSelect"
      @clear="upload.clearFile"
    />

    <button
      @click="handleUpload"
      :disabled="!upload.selectedFile.value || upload.isProcessing.value"
      class="w-full mt-4 bg-orange-600 text-white py-3 px-4 rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
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
        上傳中...
      </span>
      <span v-else>上傳檔案</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useFileUpload } from '~/composables/useFileUpload';
import { useExcelValidator } from '~/composables/useExcelValidator';
import { roadConstructionValidationConfig } from '~/utils/departmentConfig';
import { useToast } from '~/composables/useToast';
import { ALLOWED_EXCEL_EXTENSIONS } from '~/constants/fileUpload';

const { success, error } = useToast();

// 使用檔案上傳 composable，加入自訂驗證
const upload = useFileUpload({
  allowedExtensions: ALLOWED_EXCEL_EXTENSIONS,
  onValidate: async (file: File) => {
    try {
      const validationResult = await useExcelValidator(
        file,
        roadConstructionValidationConfig
      );

      if (!validationResult.isValid) {
        error(validationResult.message || '檔案驗證失敗');
        return false;
      }

      return true;
    } catch (err) {
      console.error('檔案驗證時發生錯誤:', err);
      error('檔案驗證失敗，請稍後再試。');
      return false;
    }
  },
});

const triggerFileInput = () => {
  if (typeof document !== 'undefined') {
    const input = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    if (input) input.click();
  }
};

const handleUpload = async () => {
  if (!upload.selectedFile.value) return;

  upload.isProcessing.value = true;

  try {
    const formData = new FormData();
    formData.append('file', upload.selectedFile.value);

    const response = await $fetch('/api/upload/road-construction', {
      method: 'POST',
      body: formData,
    });

    if (response.success) {
      success('檔案上傳成功！');
      console.log('上傳結果:', response.data);
      upload.clearFile();
    }
  } catch (err) {
    console.error('上傳失敗:', err);
    error('上傳失敗，請稍後再試');
  } finally {
    upload.isProcessing.value = false;
  }
};
</script>
