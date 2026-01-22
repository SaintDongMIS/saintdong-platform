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
            {{ item.name }}
          </th>
          <th
            class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50"
          >
            加總額
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="row in amountViewData"
          :key="`${row.單位}_${row.日期}`"
          class="hover:bg-gray-50"
        >
          <td
            class="sticky left-0 z-10 bg-white px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 border-r"
          >
            {{ row.單位 }}
          </td>
          <td
            class="sticky left-20 z-10 bg-white px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r"
          >
            {{ formatDate(row.日期) }}
          </td>
          <td
            v-for="item in items"
            :key="item.field"
            class="px-4 py-3 whitespace-nowrap text-right text-sm text-gray-900 border-r"
          >
            {{ formatCurrency(row[item.name]) }}
          </td>
          <td
            class="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-blue-900 bg-blue-50"
          >
            {{ formatCurrency(row.加總額) }}
          </td>
        </tr>
      </tbody>

      <!-- 總計列 -->
      <tfoot class="bg-gray-100">
        <tr>
          <td
            colspan="2"
            class="px-4 py-3 text-sm font-bold text-gray-900 text-right"
          >
            總計
          </td>
          <td
            v-for="item in items"
            :key="item.field"
            class="px-4 py-3 text-right text-sm font-bold text-gray-900 border-r"
          >
            {{ formatCurrency(totalsByItem[item.name] || 0) }}
          </td>
          <td
            class="px-4 py-3 text-right text-sm font-bold text-blue-900 bg-blue-100"
          >
            {{ formatCurrency(grandTotal) }}
          </td>
        </tr>
      </tfoot>
    </table>

    <div v-if="amountViewData.length === 0" class="text-center py-8 text-gray-500">
      目前沒有資料
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

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

// 計算金額視圖資料
const amountViewData = computed(() => {
  return props.records.map((record) => {
    const amounts = {};
    let total = 0;

    props.items.forEach((item) => {
      const quantity = record[item.field] || 0;
      const amount = quantity * item.price;
      amounts[item.name] = amount;
      total += amount;
    });

    return {
      單位: record.單位,
      日期: record.日期,
      ...amounts,
      加總額: total,
    };
  });
});

// 計算各項目總計
const totalsByItem = computed(() => {
  const totals = {};

  props.items.forEach((item) => {
    totals[item.name] = amountViewData.value.reduce(
      (sum, row) => sum + (row[item.name] || 0),
      0
    );
  });

  return totals;
});

// 計算總加總額
const grandTotal = computed(() => {
  return amountViewData.value.reduce((sum, row) => sum + (row.加總額 || 0), 0);
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};
</script>

<style scoped>
.sticky {
  position: sticky;
  background: inherit;
}
</style>
