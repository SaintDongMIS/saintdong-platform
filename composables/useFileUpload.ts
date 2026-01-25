import { ref } from 'vue';
import type { Ref } from 'vue';

export interface FileUploadOptions {
  allowedExtensions: string[];
  onValidate?: (file: File) => Promise<boolean>;
}

export interface FileUploadReturn {
  selectedFile: Ref<File | null>;
  isProcessing: Ref<boolean>;
  isDragOver: Ref<boolean>;
  handleFileSelect: (event: Event) => void;
  handleFileDrop: (event: DragEvent) => void;
  clearFile: () => void;
  validateFile: (file: File) => boolean;
}

/**
 * 可重用的檔案上傳邏輯
 */
export function useFileUpload(options: FileUploadOptions): FileUploadReturn {
  const selectedFile = ref<File | null>(null);
  const isProcessing = ref(false);
  const isDragOver = ref(false);

  /**
   * 驗證檔案副檔名
   */
  const validateFile = (file: File): boolean => {
    const fileExtension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf('.'));
    return options.allowedExtensions.includes(fileExtension);
  };

  /**
   * 處理檔案選擇
   */
  const handleFileSelect = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;

    if (!validateFile(file)) {
      return;
    }

    // 如果有自訂驗證邏輯
    if (options.onValidate) {
      isProcessing.value = true;
      try {
        const isValid = await options.onValidate(file);
        if (isValid) {
          selectedFile.value = file;
        }
      } finally {
        isProcessing.value = false;
      }
    } else {
      selectedFile.value = file;
    }
  };

  /**
   * 處理拖放檔案
   */
  const handleFileDrop = async (event: DragEvent) => {
    event.preventDefault();
    isDragOver.value = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file) return; // 確保 file 不是 undefined
    
    if (!validateFile(file)) {
      return;
    }

    // 如果有自訂驗證邏輯
    if (options.onValidate) {
      isProcessing.value = true;
      try {
        const isValid = await options.onValidate(file);
        if (isValid) {
          selectedFile.value = file;
        }
      } finally {
        isProcessing.value = false;
      }
    } else {
      selectedFile.value = file;
    }
  };

  /**
   * 清除選擇的檔案
   */
  const clearFile = () => {
    selectedFile.value = null;
  };

  return {
    selectedFile,
    isProcessing,
    isDragOver,
    handleFileSelect,
    handleFileDrop,
    clearFile,
    validateFile,
  };
}
