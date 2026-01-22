<template>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 border">
      <thead class="bg-gray-50">
        <tr>
          <th
            class="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
          >
            單位
          </th>
          <th
            class="sticky left-20 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
          >
            日期
          </th>
          <th
            v-for="item in items"
            :key="item.field"
            class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
          >
            <div>{{ item.name }}</div>
            <div class="text-gray-400 font-normal text-xs">{{ item.unit }}</div>
          </th>
          <th
            class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
          >
            操作
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="record in records"
          :key="record.DCRid"
          class="hover:bg-gray-50"
        >
          <td
            class="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r"
          >
            {{ record.單位 }}
          </td>
          <td
            class="sticky left-20 z-10 bg-white px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r"
          >
            {{ formatDate(record.日期) }}
          </td>
          <td
            v-for="item in items"
            :key="item.field"
            class="px-2 py-2 whitespace-nowrap border-r"
          >
            <input
              type="number"
              step="0.01"
              min="0"
              max="999999"
              :value="record[item.field] || 0"
              @blur="handleBlur(record, item.field, $event)"
              @keydown.enter="$event.target.blur()"
              @input="validateInput($event)"
              class="w-full px-2 py-1 text-sm text-right border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-center">
            <button
              @click="$emit('delete', record.DCRid)"
              class="text-red-600 hover:text-red-900 text-sm font-medium"
            >
              刪除
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="records.length === 0" class="text-center py-8 text-gray-500">
      目前沒有資料
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  records: {
    type: Array,
    required: true,
  },
  items: {
    type: Array,
    required: true,
  },
});

const emit = defineEmits(['update', 'delete']);

const validateInput = (event) => {
  // 即時驗證：防止輸入非數字字元
  const value = event.target.value;
  
  // 移除非數字字元（保留小數點）
  const cleaned = value.replace(/[^\d.]/g, '');
  
  // 確保只有一個小數點
  const parts = cleaned.split('.');
  if (parts.length > 2) {
    event.target.value = parts[0] + '.' + parts.slice(1).join('');
  } else {
    event.target.value = cleaned;
  }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const handleBlur = (record, field, event) => {
  let newValue = parseFloat(event.target.value);

  // 驗證數字
  if (isNaN(newValue) || !isFinite(newValue)) {
    event.target.value = record[field] || 0;
    return;
  }

  // 限制範圍：0 ~ 999,999
  if (newValue < 0) {
    newValue = 0;
    event.target.value = 0;
  } else if (newValue > 999999) {
    newValue = 999999;
    event.target.value = 999999;
  }

  // 限制小數位數為 2 位
  newValue = Math.round(newValue * 100) / 100;
  event.target.value = newValue;

  const oldValue = record[field] || 0;

  if (newValue !== oldValue) {
    const updatedRecord = {
      ...record,
      [field]: newValue,
    };
    emit('update', updatedRecord);
  }
};
</script>

<style scoped>
/* 固定左側欄位 */
.sticky {
  position: sticky;
  background: inherit;
}

/* 數字輸入框樣式 */
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
