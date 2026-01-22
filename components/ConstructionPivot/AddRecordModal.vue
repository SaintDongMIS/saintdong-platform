<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900">新增施工記錄</h3>
          <button
            @click="$emit('close')"
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

        <form @submit.prevent="handleSubmit">
          <div class="space-y-4">
            <!-- 單位選擇 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                單位 <span class="text-red-500">*</span>
              </label>
              <select
                v-model="formData.單位"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">請選擇單位</option>
                <option v-for="unit in availableUnits" :key="unit" :value="unit">
                  {{ unit }}
                </option>
              </select>
            </div>

            <!-- 日期選擇 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                日期 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formData.日期"
                type="date"
                required
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <!-- 提示訊息 -->
          <div class="mt-4 p-3 bg-blue-50 rounded-lg">
            <p class="text-sm text-blue-800">
              💡 新增後可在數量視圖中編輯各項目的數量
            </p>
          </div>

          <!-- 按鈕 -->
          <div class="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              新增
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  availableUnits: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['close', 'save']);

const formData = ref({
  單位: '',
  日期: new Date().toISOString().split('T')[0],
});

const handleSubmit = () => {
  emit('save', formData.value);
};
</script>
