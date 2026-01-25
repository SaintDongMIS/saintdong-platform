<template>
  <div
    v-if="modelValue"
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">jim測試用</h3>
          <button
            @click="emit('update:modelValue', false)"
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

        <FileUploadZone
          :selected-file="upload.selectedFile.value"
          :is-drag-over="upload.isDragOver.value"
          accept=".xlsx,.xls,.csv"
          accept-text="支援 .xlsx, .xls, .csv 格式"
          color="blue"
          input-ref="jimFileInput"
          @dragover="upload.isDragOver.value = true"
          @dragleave="upload.isDragOver.value = false"
          @drop="upload.handleFileDrop"
          @click="triggerFileInput"
          @change="upload.handleFileSelect"
          @clear="upload.clearFile"
        />

        <button
          @click="handleProcess"
          :disabled="!upload.selectedFile.value || upload.isProcessing.value"
          class="w-full mt-4 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          <span
            v-if="upload.isProcessing.value"
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
</template>

<script setup lang="ts">
import { useFileUpload } from '~/composables/useFileUpload';
import { useToast } from '~/composables/useToast';
import { ALLOWED_EXCEL_EXTENSIONS, TOAST_LONG_DURATION_MS } from '~/constants/fileUpload';
import { formatFileSize } from '~/utils/fileUtils';

interface Props {
  modelValue: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const { success, error, info } = useToast();

const upload = useFileUpload({
  allowedExtensions: ALLOWED_EXCEL_EXTENSIONS,
});

const triggerFileInput = () => {
  if (typeof document !== 'undefined') {
    const input = document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;
    if (input) input.click();
  }
};

const handleProcess = async () => {
  if (!upload.selectedFile.value) return;

  upload.isProcessing.value = true;

  try {
    const formData = new FormData();
    formData.append('file', upload.selectedFile.value);

    const response = await $fetch('/api/process-excel', {
      method: 'POST',
      body: formData,
    });

    // 檢查回應格式 (預覽模式會回傳 JSON)
    if (response && typeof response === 'object' && response.isPreview) {
      const previewData = response.data;

      // 顯示預覽結果
      const message = `
📊 Excel 檔案預覽完成 (未寫入資料庫)

📁 檔案資訊:
  • 檔名: ${previewData.fileName}
  • 檔案大小: ${formatFileSize(previewData.fileSize)}

📈 Excel 統計:
  • 總行數: ${previewData.excelStats.totalRows}
  • 有效行數: ${previewData.excelStats.validRows}
  • 跳過行數: ${previewData.excelStats.skippedRows}

💾 資料庫預覽:
  • 將會插入: ${previewData.previewStats.wouldInsertCount} 筆
  • 將會跳過: ${previewData.previewStats.wouldSkipCount} 筆 (重複資料)
  • 重複鍵數量: ${previewData.previewStats.duplicateCount} 個

✅ 所有驗證通過！檔案處理完成，正在下載...
      `.trim();

      info(message, TOAST_LONG_DURATION_MS);
      console.log('預覽結果詳細資料:', previewData);

      if (previewData.sampleData && previewData.sampleData.length > 0) {
        console.log('前 5 筆資料預覽:', previewData.sampleData);
      }

      // 生成並下載處理後的 Excel 檔案
      if (previewData.processedRows && previewData.processedRows.length > 0) {
        await downloadProcessedExcel(
          previewData.processedRows,
          previewData.fileName
        );
        success('✅ 預覽完成！處理後的 Excel 已下載');
      } else {
        success('✅ 預覽完成！詳細資訊請查看通知訊息');
      }

      upload.clearFile();
      emit('update:modelValue', false);
    } else {
      error('回應格式錯誤');
    }
  } catch (err) {
    console.error('處理失敗:', err);
    error('處理失敗，請稍後再試');
  } finally {
    upload.isProcessing.value = false;
  }
};

/**
 * 下載處理後的 Excel 檔案
 */
const downloadProcessedExcel = async (processedRows: any[], originalFileName: string) => {
  try {
    const XLSX = await import('xlsx');

    const worksheet = XLSX.utils.json_to_sheet(processedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '處理後資料');

    const fileName = originalFileName.replace(
      /\.(xlsx?|csv)$/i,
      '_processed.xlsx'
    );

    XLSX.writeFile(workbook, fileName);

    console.log('Excel 檔案已生成並下載:', fileName);
  } catch (err) {
    console.error('生成 Excel 檔案失敗:', err);
    error('生成 Excel 檔案失敗');
  }
};
</script>
