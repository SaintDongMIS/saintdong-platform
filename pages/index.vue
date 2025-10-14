<template>
  <div class="py-12 px-4 sm:px-6 lg:px-8">
    <!-- 成功/失敗彈窗通知 -->
    <div
      v-if="showNotification"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      @click="closeNotification"
    >
      <div
        class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-all"
        :class="notificationType === 'error' ? 'animate-pulse' : ''"
        @click.stop
      >
        <div class="p-6">
          <!-- 圖示 -->
          <div
            class="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full"
            :class="
              notificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
            "
          >
            <svg
              v-if="notificationType === 'success'"
              class="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
            <svg
              v-else
              class="w-6 h-6 text-red-600"
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
          </div>

          <!-- 標題 -->
          <h3 class="text-lg font-medium text-gray-900 text-center mb-2">
            {{ notificationType === 'success' ? '上傳成功！' : '上傳失敗' }}
          </h3>

          <!-- 訊息 -->
          <p class="text-sm text-gray-600 text-center mb-4">
            {{ notificationMessage }}
          </p>

          <!-- 詳細資訊（成功時顯示） -->
          <div
            v-if="notificationType === 'success' && notificationDetails"
            class="bg-gray-50 rounded-lg p-4 mb-4"
          >
            <h4 class="font-medium text-gray-900 mb-2">處理結果：</h4>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="font-medium">總行數:</span>
                {{ notificationDetails.excelStats.totalRows }}
              </div>
              <div>
                <span class="font-medium">有效行數:</span>
                {{ notificationDetails.excelStats.validRows }}
              </div>
              <div>
                <span class="font-medium">插入成功:</span>
                {{ notificationDetails.databaseStats.insertedCount }}
              </div>
              <div>
                <span class="font-medium">跳過重複:</span>
                {{ notificationDetails.databaseStats.skippedCount }}
              </div>
            </div>
          </div>

          <!-- 錯誤詳情（失敗時顯示） -->
          <div
            v-if="
              notificationType === 'error' &&
              notificationErrors &&
              notificationErrors.length > 0
            "
            class="bg-red-50 rounded-lg p-4 mb-4"
          >
            <h4 class="font-medium text-red-900 mb-2">錯誤詳情：</h4>
            <ul class="text-sm text-red-700 space-y-1">
              <li
                v-for="error in notificationErrors.slice(0, 3)"
                :key="error"
                class="flex items-start"
              >
                <span
                  class="inline-block w-1 h-1 bg-red-500 rounded-full mt-2 mr-2 flex-shrink-0"
                ></span>
                {{ error }}
              </li>
              <li
                v-if="notificationErrors.length > 3"
                class="text-red-600 font-medium"
              >
                還有 {{ notificationErrors.length - 3 }} 個錯誤...
              </li>
            </ul>
          </div>

          <!-- 按鈕 -->
          <div class="flex justify-center">
            <button
              @click="closeNotification"
              class="px-6 py-2 rounded-md text-sm font-medium transition-colors"
              :class="
                notificationType === 'success'
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-red-600 text-white hover:bg-red-700'
              "
            >
              確定
            </button>
          </div>
        </div>
      </div>
    </div>

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
            @dragover.prevent="isDragOver = true"
            @dragleave.prevent="isDragOver = false"
            @drop.prevent="handleFileDrop"
            @click="$refs.fileInput.click()"
            :class="{ 'border-blue-400 bg-blue-50': isDragOver }"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              @change="handleFileSelect"
              class="hidden"
            />
            <div v-if="!selectedFile" class="cursor-pointer">
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
              <p class="text-xs text-gray-500">支援 .xlsx, .xls, .csv 格式</p>
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
              <!-- 詳細處理結果 -->
              <div
                v-if="uploadResult.success && uploadResult.data"
                class="mt-3 text-xs text-green-700"
              >
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <span class="font-medium">檔案名稱:</span>
                    {{ uploadResult.data.fileName }}
                  </div>
                  <div>
                    <span class="font-medium">檔案大小:</span>
                    {{ formatFileSize(uploadResult.data.fileSize) }}
                  </div>
                  <div>
                    <span class="font-medium">總行數:</span>
                    {{ uploadResult.data.excelStats.totalRows }}
                  </div>
                  <div>
                    <span class="font-medium">有效行數:</span>
                    {{ uploadResult.data.excelStats.validRows }}
                  </div>
                  <div>
                    <span class="font-medium">跳過行數:</span>
                    {{ uploadResult.data.excelStats.skippedRows }}
                  </div>
                  <div>
                    <span class="font-medium">插入成功:</span>
                    {{ uploadResult.data.databaseStats.insertedCount }}
                  </div>
                  <div>
                    <span class="font-medium">跳過重複:</span>
                    {{ uploadResult.data.databaseStats.skippedCount }}
                  </div>
                  <div>
                    <span class="font-medium">錯誤數量:</span>
                    {{ uploadResult.data.databaseStats.errorCount }}
                  </div>
                </div>
                <div
                  v-if="
                    uploadResult.data.errors &&
                    uploadResult.data.errors.length > 0
                  "
                  class="mt-2"
                >
                  <span class="font-medium text-red-600">錯誤詳情:</span>
                  <ul class="list-disc list-inside mt-1">
                    <li
                      v-for="error in uploadResult.data.errors"
                      :key="error"
                      class="text-red-600"
                    >
                      {{ error }}
                    </li>
                  </ul>
                </div>
              </div>
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
const isDragOver = ref(false);

// 彈窗通知相關狀態
const showNotification = ref(false);
const notificationType = ref('success'); // 'success' 或 'error'
const notificationMessage = ref('');
const notificationDetails = ref(null);
const notificationErrors = ref([]);

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    validateAndSetFile(file);
  }
};

const handleFileDrop = (event) => {
  event.preventDefault();
  isDragOver.value = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    validateAndSetFile(file);
  }
};

const validateAndSetFile = (file) => {
  const allowedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
  ];

  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf('.'));

  if (
    !allowedTypes.includes(file.type) &&
    !allowedExtensions.includes(fileExtension)
  ) {
    uploadResult.value = {
      success: false,
      message: '請選擇 Excel 檔案 (.xlsx, .xls) 或 CSV 檔案 (.csv)',
    };
    return;
  }

  selectedFile.value = file;
  uploadResult.value = null;
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

    // 顯示成功彈窗
    showSuccessNotification(
      response.message || '檔案上傳成功！',
      response.data
    );

    uploadResult.value = {
      success: true,
      message: response.message || '檔案上傳成功！',
      data: response.data,
    };

    clearFile();
  } catch (error) {
    console.error('上傳失敗:', error);

    // 顯示失敗彈窗
    showErrorNotification(
      error.data?.message || '上傳失敗，請稍後再試',
      error.data?.errors || []
    );

    uploadResult.value = {
      success: false,
      message: error.data?.message || '上傳失敗，請稍後再試',
    };
  } finally {
    isUploading.value = false;
  }
};

// 顯示成功通知
const showSuccessNotification = (message, details) => {
  notificationType.value = 'success';
  notificationMessage.value = message;
  notificationDetails.value = details;
  notificationErrors.value = [];
  showNotification.value = true;
};

// 顯示錯誤通知
const showErrorNotification = (message, errors = []) => {
  notificationType.value = 'error';
  notificationMessage.value = message;
  notificationDetails.value = null;
  notificationErrors.value = errors;
  showNotification.value = true;
};

// 關閉通知
const closeNotification = () => {
  showNotification.value = false;
  notificationMessage.value = '';
  notificationDetails.value = null;
  notificationErrors.value = [];
};
</script>
