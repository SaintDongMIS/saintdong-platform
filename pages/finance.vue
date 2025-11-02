<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 部門標題 -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex items-center space-x-3">
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
          <div>
            <h1 class="text-2xl font-bold text-gray-900">財務部門</h1>
            <p class="text-gray-600">財務報表管理系統</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 標籤頁導航 -->
    <div class="bg-white border-b">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav class="flex space-x-8">
          <button
            @click="activeTab = 'reports'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'reports'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
          >
            <div class="flex items-center space-x-2">
              <svg
                class="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                ></path>
              </svg>
              <span>報表管理</span>
            </div>
          </button>
          <button
            @click="activeTab = 'import'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === 'import'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ]"
          >
            <div class="flex items-center space-x-2">
              <svg
                class="w-4 h-4"
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
              <span>資料匯入</span>
            </div>
          </button>
        </nav>

        <!-- 隱藏的 jim測試用 按鈕 -->
        <div class="mt-2 text-right">
          <button
            @click="showJimTest = !showJimTest"
            class="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            jim測試用
          </button>
        </div>
      </div>
    </div>

    <!-- 標籤頁內容 -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- 報表管理 -->
      <FinanceReports v-if="activeTab === 'reports'" />

      <!-- 資料匯入 (原有的 Excel 上傳功能) -->
      <div v-if="activeTab === 'import'">
        <div class="bg-white rounded-lg shadow-sm border p-6">
          <div class="text-center mb-8">
            <div
              class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"
            >
              <svg
                class="w-8 h-8 text-blue-600"
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
            <p class="text-gray-600">上傳財務報銷單 Excel 檔案</p>
          </div>

          <!-- 原有的上傳功能 -->
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
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

            <div v-if="!selectedFile">
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

          <button
            @click="uploadFile"
            :disabled="!selectedFile || isUploading"
            class="w-full mt-4 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
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
        </div>
      </div>
    </div>

    <!-- jim測試用 彈出視窗 -->
    <div
      v-if="showJimTest"
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">jim測試用</h3>
            <button
              @click="showJimTest = false"
              class="text-gray-400 hover:text-gray-600"
            >
              <svg
                class="w-5 h-5"
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

          <p class="text-sm text-gray-600 mb-4">
            上傳 Excel 檔案，系統會處理資料並返回處理後的檔案供下載
          </p>

          <!-- 檔案上傳區域 -->
          <div
            class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
            @dragover.prevent="isJimDragOver = true"
            @dragleave.prevent="isJimDragOver = false"
            @drop.prevent="handleJimFileDrop"
            @click="$refs.jimFileInput.click()"
            :class="{ 'border-blue-400 bg-blue-50': isJimDragOver }"
          >
            <input
              ref="jimFileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              @change="handleJimFileSelect"
              class="hidden"
            />

            <div v-if="!jimSelectedFile">
              <svg
                class="mx-auto h-8 w-8 text-gray-400"
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
                    class="h-6 w-6 text-green-500 mr-3"
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
                      {{ jimSelectedFile.name }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ formatFileSize(jimSelectedFile.size) }}
                    </p>
                  </div>
                </div>
                <button
                  @click="clearJimFile"
                  class="text-red-500 hover:text-red-700"
                >
                  <svg
                    class="h-4 w-4"
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

          <!-- 處理按鈕 -->
          <button
            @click="processJimFile"
            :disabled="!jimSelectedFile || isJimProcessing"
            class="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <span
              v-if="isJimProcessing"
              class="flex items-center justify-center"
            >
              <svg
                class="animate-spin -ml-1 mr-3 h-4 w-4 text-white"
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
            <span v-else>處理檔案</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useExcelValidator } from '~/composables/useExcelValidator';
import { financeValidationConfig } from '~/utils/departmentConfig';

const activeTab = ref('reports');
const selectedFile = ref(null);
const isUploading = ref(false);
const isDragOver = ref(false);

// jim測試用 相關狀態
const showJimTest = ref(false);
const jimSelectedFile = ref(null);
const isJimProcessing = ref(false);
const isJimDragOver = ref(false);

// 檔案上傳相關邏輯 (沿用原有邏輯)
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

const validateAndSetFile = async (file) => {
  // 1. 基本檔案類型檢查
  const allowedExtensions = ['.xlsx', '.xls', '.csv'];
  const fileExtension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf('.'));

  if (!allowedExtensions.includes(fileExtension)) {
    alert('請選擇 Excel 檔案 (.xlsx, .xls) 或 CSV 檔案 (.csv)');
    return;
  }

  // 2. Excel 標頭驗證
  isUploading.value = true; // 顯示處理中狀態
  try {
    const validationResult = await useExcelValidator(
      file,
      financeValidationConfig
    );

    if (!validationResult.isValid) {
      alert(validationResult.message);
      clearFile(); // 清除無效檔案
      return;
    }

    // 驗證通過
    selectedFile.value = file;
  } catch (error) {
    console.error('檔案驗證時發生錯誤:', error);
    alert('檔案驗證失敗，請稍後再試。');
  } finally {
    isUploading.value = false;
  }
};

const clearFile = () => {
  selectedFile.value = null;
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

  try {
    const formData = new FormData();
    formData.append('file', selectedFile.value);

    const response = await $fetch('/api/upload/finance', {
      method: 'POST',
      body: formData,
    });

    alert('檔案上傳成功！');
    clearFile();
  } catch (error) {
    console.error('上傳失敗:', error);
    alert('上傳失敗，請稍後再試');
  } finally {
    isUploading.value = false;
  }
};

// jim測試用 相關方法
const handleJimFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    validateAndSetJimFile(file);
  }
};

const handleJimFileDrop = (event) => {
  event.preventDefault();
  isJimDragOver.value = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    const file = files[0];
    validateAndSetJimFile(file);
  }
};

const validateAndSetJimFile = (file) => {
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
    alert('請選擇 Excel 檔案 (.xlsx, .xls) 或 CSV 檔案 (.csv)');
    return;
  }

  jimSelectedFile.value = file;
};

const clearJimFile = () => {
  jimSelectedFile.value = null;
  if (typeof document !== 'undefined') {
    const fileInput = document.querySelector('input[ref="jimFileInput"]');
    if (fileInput) fileInput.value = '';
  }
};

const processJimFile = async () => {
  if (!jimSelectedFile.value) return;

  isJimProcessing.value = true;

  try {
    const formData = new FormData();
    formData.append('file', jimSelectedFile.value);

    const response = await $fetch('/api/process-excel', {
      method: 'POST',
      body: formData,
    });

    // 處理檔案下載
    const blob = new Blob([response], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // 從回應標頭取得檔案名稱，如果沒有則使用預設名稱
    const contentDisposition = response.headers?.get('content-disposition');
    let fileName = '處理後的檔案.xlsx';

    if (contentDisposition) {
      const fileNameMatch = contentDisposition.match(
        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
      );
      if (fileNameMatch && fileNameMatch[1]) {
        fileName = fileNameMatch[1].replace(/['"]/g, '');
      }
    }

    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    alert('檔案處理完成並已下載！');
    clearJimFile();
    showJimTest.value = false;
  } catch (error) {
    console.error('處理失敗:', error);
    alert('處理失敗，請稍後再試');
  } finally {
    isJimProcessing.value = false;
  }
};
</script>
