<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ isEditMode ? '編輯施工項目' : '新增施工項目' }}
          </h3>
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
            <!-- 項目名稱 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                項目名稱 <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formData.ItemName"
                type="text"
                required
                maxlength="100"
                placeholder="例如：拖車租工"
                @input="validateItemName"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p class="mt-1 text-xs text-gray-500">
                限 100 字元，不可包含特殊符號（&lt; &gt; " ' ; -- 等）
              </p>
            </div>

            <!-- 單位 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                單位 <span class="text-red-500">*</span>
              </label>
              <div class="flex items-start space-x-2">
                <input
                  v-model="formData.Unit"
                  type="text"
                  required
                  placeholder="例如：天、頓、台、小時、桶"
                  :disabled="isEditMode && hasHistoricalData"
                  :class="[
                    'flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
                    isEditMode && hasHistoricalData
                      ? 'bg-gray-100 cursor-not-allowed'
                      : '',
                  ]"
                />
                <button
                  v-if="isEditMode && !hasHistoricalData"
                  type="button"
                  @click="showUnitWarning = true"
                  class="px-3 py-2 text-yellow-600 hover:text-yellow-800 border border-yellow-300 rounded-lg"
                  title="修改單位的影響"
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
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                </button>
              </div>
              <p
                v-if="isEditMode && hasHistoricalData"
                class="mt-1 text-xs text-gray-500"
              >
                ⚠️ 此項目有歷史記錄，單位已鎖定
              </p>
            </div>

            <!-- 單價 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                單價 <span class="text-red-500">*</span>
              </label>
              <input
                v-model.number="formData.Price"
                type="number"
                step="0.01"
                min="0"
                max="9999999"
                required
                placeholder="例如：12000"
                @input="validatePrice"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p v-if="isEditMode" class="mt-1 text-xs text-blue-600">
                💡 修改單價只影響新增的記錄，歷史記錄的金額不會改變
              </p>
              <p v-else class="mt-1 text-xs text-gray-500">
                限制範圍：0 ~ 9,999,999
              </p>
            </div>

            <!-- 顯示順序 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                顯示順序
              </label>
              <input
                v-model.number="formData.DisplayOrder"
                type="number"
                min="0"
                placeholder="數字越小越靠前（預設為 0）"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
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
              {{ isEditMode ? '儲存' : '新增' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 單位修改警告 Modal -->
    <div
      v-if="showUnitWarning"
      class="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <div class="flex items-start mb-4">
          <div class="flex-shrink-0">
            <svg
              class="h-6 w-6 text-yellow-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              ></path>
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-lg font-medium text-gray-900">修改單位的影響</h3>
            <div class="mt-2 text-sm text-gray-600">
              <p class="mb-2">⚠️ 修改單位會導致嚴重問題：</p>
              <ul class="list-disc list-inside space-y-1 ml-2">
                <li>歷史資料的「數量」會失去意義</li>
                <li>例如：原本記錄的「100 頓」改成「台」後，不知道是 100 頓還是 100 台</li>
              </ul>
              <p class="mt-3 font-semibold text-yellow-700">
                建議做法：停用舊項目，新增一個新項目
              </p>
            </div>
          </div>
        </div>
        <div class="flex justify-end">
          <button
            @click="showUnitWarning = false"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    default: null,
  },
  isEditMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'save']);

const showUnitWarning = ref(false);

const formData = ref({
  ItemName: '',
  Unit: '',
  Price: 0,
  DisplayOrder: 0,
});

const hasHistoricalData = computed(() => {
  // TODO: 可以從後端 API 查詢是否有歷史記錄
  // 目前簡化處理：編輯模式時假設有歷史記錄
  return props.isEditMode;
});

watch(
  () => props.item,
  (newItem) => {
    if (newItem) {
      formData.value = {
        ItemId: newItem.ItemId,
        ItemName: newItem.ItemName,
        Unit: newItem.Unit,
        Price: newItem.Price,
        DisplayOrder: newItem.DisplayOrder || 0,
      };
    } else {
      formData.value = {
        ItemName: '',
        Unit: '',
        Price: 0,
        DisplayOrder: 0,
      };
    }
  },
  { immediate: true }
);

const validateItemName = (event) => {
  // 移除危險字元
  const value = event.target.value;
  const cleaned = value.replace(/[<>"';]/g, '');
  
  if (value !== cleaned) {
    event.target.value = cleaned;
    formData.value.ItemName = cleaned;
  }
};

const validatePrice = (event) => {
  let value = parseFloat(event.target.value);
  
  if (isNaN(value) || value < 0) {
    value = 0;
  } else if (value > 9999999) {
    value = 9999999;
  }
  
  // 限制小數位數為 2 位
  value = Math.round(value * 100) / 100;
  
  formData.value.Price = value;
};

const handleSubmit = () => {
  // 最終驗證
  if (!formData.value.ItemName || formData.value.ItemName.trim().length === 0) {
    alert('請輸入項目名稱');
    return;
  }
  
  if (!formData.value.Unit || formData.value.Unit.trim().length === 0) {
    alert('請輸入單位');
    return;
  }
  
  if (formData.value.Price < 0 || formData.value.Price > 9999999) {
    alert('單價範圍錯誤（0 ~ 9,999,999）');
    return;
  }
  
  emit('save', formData.value);
};
</script>
