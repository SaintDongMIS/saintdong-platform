<template>
  <div class="py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-2xl mx-auto">
      <!-- 財務部門標題 -->
      <div class="text-center mb-8">
        <div class="flex items-center justify-center space-x-3 mb-4">
          <div
            class="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"
          >
            <svg
              class="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-gray-900">財務部門</h1>
        </div>
        <p class="text-gray-600">Excel 檔案上傳系統</p>
      </div>

      <!-- 檔案上傳區域 -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            選擇 Excel 檔案
          </label>
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls"
              @change="handleFileSelect"
              class="hidden"
            />
            <div
              v-if="!selectedFile"
              @click="$refs.fileInput.click()"
              class="cursor-pointer"
            >
              <svg
                class="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <p class="mt-2 text-sm text-gray-600">點擊選擇檔案或拖拽到這裡</p>
              <p class="text-xs text-gray-500">支援 .xlsx, .xls 格式</p>
            </div>
            <div v-else class="text-left">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <svg
                    class="h-8 w-8 text-green-500 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-gray-900">
                      {{ selectedFile.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ formatFileSize(selectedFile.size) }}
                    </p>
                  </div>
                </div>
                <button
                  @click="clearFile"
                  class="text-red-500 hover:text-red-700"
                >
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 上傳按鈕 -->
        <button
          @click="uploadFile"
          :disabled="!selectedFile || isUploading"
          class="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          <span v-if="isUploading" class="flex items-center justify-center">
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

        <!-- 上傳結果 -->
        <div
          v-if="uploadResult"
          class="mt-4 p-4 rounded-md"
          :class="
            uploadResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          "
        >
          <div class="flex">
            <div class="flex-shrink-0">
              <svg
                v-if="uploadResult.success"
                class="h-5 w-5 text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clip-rule="evenodd"
                ></path>
              </svg>
              <svg
                v-else
                class="h-5 w-5 text-red-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clip-rule="evenodd"
                ></path>
              </svg>
            </div>
            <div class="ml-3">
              <p
                class="text-sm font-medium"
                :class="
                  uploadResult.success ? 'text-green-800' : 'text-red-800'
                "
              >
                {{ uploadResult.message }}
              </p>
              <p
                v-if="uploadResult.success && uploadResult.filePath"
                class="mt-1 text-xs"
                :class="
                  uploadResult.success ? 'text-green-700' : 'text-red-700'
                "
              >
                檔案已儲存至: {{ uploadResult.filePath }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const selectedFile = ref(null);
const isUploading = ref(false);
const uploadResult = ref(null);

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];

    if (!allowedTypes.includes(file.type)) {
      uploadResult.value = {
        success: false,
        message: '請選擇 Excel 檔案 (.xlsx 或 .xls)',
      };
      return;
    }

    selectedFile.value = file;
    uploadResult.value = null;
  }
};

const clearFile = () => {
  selectedFile.value = null;
  uploadResult.value = null;
  if (typeof document !== 'undefined') {
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  }
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const uploadFile = async () => {
  if (!selectedFile.value) return;

  isUploading.value = true;
  uploadResult.value = null;

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);

    const response = await $fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    uploadResult.value = {
      success: true,
      message: '檔案上傳成功！',
      filePath: response.filePath,
    };

    clearFile();
  } catch (error) {
    console.error('上傳失敗:', error);
    uploadResult.value = {
      success: false,
      message: error.data?.message || '上傳失敗，請稍後再試',
    };
  } finally {
    isUploading.value = false;
  }
};
</script>
