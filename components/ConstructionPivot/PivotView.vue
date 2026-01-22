<template>
  <div class="overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200 border">
      <thead class="bg-gray-50">
        <tr>
          <th
            rowspan="2"
            class="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
          >
            單位
          </th>
          <th
            v-for="item in items"
            :key="item.field"
            colspan="2"
            class="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-r"
          >
            {{ item.name }}
          </th>
          <th
            rowspan="2"
            class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50"
          >
            加總額
          </th>
        </tr>
        <tr>
          <template v-for="item in items" :key="item.field">
            <th
              class="px-2 py-2 text-center text-xs font-medium text-gray-400 border-r"
            >
              數量
            </th>
            <th
              class="px-2 py-2 text-center text-xs font-medium text-gray-400 border-r"
            >
              金額
            </th>
          </template>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <template v-for="group in pivotData" :key="group.單位">
          <!-- 單位總計列 -->
          <tr
            class="font-bold bg-blue-50 hover:bg-blue-100 cursor-pointer"
            @click="toggleExpand(group.單位)"
          >
            <td
              class="sticky left-0 z-10 bg-blue-50 px-4 py-3 whitespace-nowrap text-sm text-gray-900 border-r"
            >
              <div class="flex items-center space-x-2">
                <svg
                  class="w-4 h-4 transition-transform"
                  :class="{ 'rotate-90': expandedUnits.includes(group.單位) }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  ></path>
                </svg>
                <span>{{ group.單位 }}</span>
              </div>
            </td>
            <template v-for="item in items" :key="item.field">
              <td
                class="px-2 py-3 whitespace-nowrap text-right text-sm text-gray-900 border-r"
              >
                {{ formatNumber(group[`${item.name}_數量`]) }}
              </td>
              <td
                class="px-2 py-3 whitespace-nowrap text-right text-sm text-gray-900 border-r"
              >
                {{ formatCurrency(group[`${item.name}_金額`]) }}
              </td>
            </template>
            <td
              class="px-4 py-3 whitespace-nowrap text-right text-sm font-bold text-blue-900 bg-blue-100"
            >
              {{ formatCurrency(group.加總額) }}
            </td>
          </tr>

          <!-- 明細列（可展開） -->
          <template v-if="expandedUnits.includes(group.單位)">
            <tr
              v-for="(detail, index) in group.明細"
              :key="`${group.單位}_${detail.日期}_${index}`"
              class="bg-gray-50"
            >
              <td
                class="sticky left-0 z-10 bg-gray-50 px-4 py-2 pl-12 whitespace-nowrap text-sm text-gray-700 border-r"
              >
                {{ formatDate(detail.日期) }}
              </td>
              <template v-for="item in items" :key="item.field">
                <td
                  class="px-2 py-2 whitespace-nowrap text-right text-xs text-gray-700 border-r"
                >
                  {{ formatNumber(detail[`${item.name}_數量`]) }}
                </td>
                <td
                  class="px-2 py-2 whitespace-nowrap text-right text-xs text-gray-700 border-r"
                >
                  {{ formatCurrency(detail[`${item.name}_金額`]) }}
                </td>
              </template>
              <td class="px-4 py-2"></td>
            </tr>
          </template>
        </template>
      </tbody>

      <!-- 總計列 -->
      <tfoot class="bg-gray-200">
        <tr>
          <td class="px-4 py-3 text-sm font-bold text-gray-900 text-right">
            總計
          </td>
          <template v-for="item in items" :key="item.field">
            <td
              class="px-2 py-3 text-right text-sm font-bold text-gray-900 border-r"
            >
              {{ formatNumber(grandTotals[`${item.name}_數量`] || 0) }}
            </td>
            <td
              class="px-2 py-3 text-right text-sm font-bold text-gray-900 border-r"
            >
              {{ formatCurrency(grandTotals[`${item.name}_金額`] || 0) }}
            </td>
          </template>
          <td
            class="px-4 py-3 text-right text-sm font-bold text-blue-900 bg-blue-200"
          >
            {{ formatCurrency(grandTotals.加總額 || 0) }}
          </td>
        </tr>
      </tfoot>
    </table>

    <div v-if="pivotData.length === 0" class="text-center py-8 text-gray-500">
      目前沒有資料
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

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

const expandedUnits = ref([]);

// 切換展開/收合
const toggleExpand = (unit) => {
  const index = expandedUnits.value.indexOf(unit);
  if (index > -1) {
    expandedUnits.value.splice(index, 1);
  } else {
    expandedUnits.value.push(unit);
  }
};

// 計算樞紐資料
const pivotData = computed(() => {
  // 按單位分組
  const groupedByUnit = {};

  props.records.forEach((record) => {
    const unit = record.單位 || '未分類';
    if (!groupedByUnit[unit]) {
      groupedByUnit[unit] = [];
    }
    groupedByUnit[unit].push(record);
  });

  // 計算每個單位的統計
  return Object.entries(groupedByUnit).map(([unit, items]) => {
    const stats = {
      單位: unit,
      明細: [],
    };

    // 計算總計
    props.items.forEach((item) => {
      const totalQuantity = items.reduce(
        (sum, r) => sum + (r[item.field] || 0),
        0
      );
      const totalAmount = totalQuantity * item.price;
      stats[`${item.name}_數量`] = totalQuantity;
      stats[`${item.name}_金額`] = totalAmount;
    });

    // 計算加總額
    stats.加總額 = props.items.reduce((sum, item) => {
      return sum + stats[`${item.name}_金額`];
    }, 0);

    // 按日期分組明細
    const byDate = {};
    items.forEach((record) => {
      const date = record.日期;
      if (!byDate[date]) {
        byDate[date] = { 日期: date, items: [] };
      }
      byDate[date].items.push(record);
    });

    stats.明細 = Object.values(byDate)
      .map((dateGroup) => {
        const dateStats = { 日期: dateGroup.日期 };
        props.items.forEach((item) => {
          const qty = dateGroup.items.reduce(
            (sum, r) => sum + (r[item.field] || 0),
            0
          );
          dateStats[`${item.name}_數量`] = qty;
          dateStats[`${item.name}_金額`] = qty * item.price;
        });
        return dateStats;
      })
      .sort((a, b) => new Date(b.日期) - new Date(a.日期)); // 按日期降序排列

    return stats;
  });
});

// 計算總計
const grandTotals = computed(() => {
  const totals = {
    加總額: 0,
  };

  props.items.forEach((item) => {
    totals[`${item.name}_數量`] = 0;
    totals[`${item.name}_金額`] = 0;
  });

  pivotData.value.forEach((group) => {
    props.items.forEach((item) => {
      totals[`${item.name}_數量`] += group[`${item.name}_數量`] || 0;
      totals[`${item.name}_金額`] += group[`${item.name}_金額`] || 0;
    });
    totals.加總額 += group.加總額 || 0;
  });

  return totals;
});

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
  });
};

const formatNumber = (num) => {
  if (!num && num !== 0) return '-';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
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

.rotate-90 {
  transform: rotate(90deg);
}
</style>
