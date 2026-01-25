<template>
  <div
    class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
    @dragover.prevent="emit('dragover')"
    @dragleave.prevent="emit('dragleave')"
    @drop.prevent="emit('drop', $event)"
    @click="emit('click')"
    :class="getDragOverClass"
  >
    <input
      :ref="inputRef"
      type="file"
      :accept="accept"
      @change="emit('change', $event)"
      class="hidden"
    />

    <!-- 未選擇檔案時 -->
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
      <div class="mt-4">
        <p class="text-sm text-gray-600">
          拖曳檔案到這裡，或
          <span :class="getColorClass">點擊選擇檔案</span>
        </p>
        <p class="text-xs text-gray-500 mt-1">{{ acceptText }}</p>
      </div>
    </div>

    <!-- 已選擇檔案時 -->
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
              {{ fileSize }}
            </p>
          </div>
        </div>
        <button
          @click.stop="emit('clear')"
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
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatFileSize } from '~/utils/fileUtils';

interface Props {
  selectedFile: File | null;
  isDragOver?: boolean;
  accept: string;
  acceptText: string;
  color?: string;
  inputRef?: string;
}

interface Emits {
  (e: 'dragover'): void;
  (e: 'dragleave'): void;
  (e: 'drop', event: DragEvent): void;
  (e: 'click'): void;
  (e: 'change', event: Event): void;
  (e: 'clear'): void;
}

const props = withDefaults(defineProps<Props>(), {
  isDragOver: false,
  color: 'blue',
  inputRef: 'fileInput',
});

const emit = defineEmits<Emits>();

const fileSize = computed(() => {
  return props.selectedFile ? formatFileSize(props.selectedFile.size) : '';
});

const getDragOverClass = computed(() => {
  if (!props.isDragOver) return '';
  
  const colorMap: Record<string, string> = {
    blue: 'border-blue-400 bg-blue-50',
    green: 'border-green-400 bg-green-50',
    purple: 'border-purple-400 bg-purple-50',
  };
  
  return colorMap[props.color] || 'border-blue-400 bg-blue-50';
});

const getColorClass = computed(() => {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-600 font-medium',
    green: 'text-green-600 font-medium',
    purple: 'text-purple-600 font-medium',
  };
  
  return colorMap[props.color] || 'text-blue-600 font-medium';
});
</script>
