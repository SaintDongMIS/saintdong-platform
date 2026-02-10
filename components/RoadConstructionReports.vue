<template>
  <div>
    <!-- 搜尋與篩選 -->
    <div class="bg-white p-4 rounded-lg shadow-sm border mb-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          v-model="searchParams.dispatchOrderNumber"
          type="text"
          placeholder="派工單號"
          class="form-input"
        />
        <input
          v-model="searchParams.itemName"
          type="text"
          placeholder="項目名稱"
          class="form-input"
        />
        <input
          v-model="searchParams.startDate"
          type="date"
          placeholder="起始日期"
          class="form-input"
        />
        <input
          v-model="searchParams.endDate"
          type="date"
          placeholder="結束日期"
          class="form-input"
        />
      </div>
      <div class="mt-4 flex justify-end space-x-2">
        <button @click="resetSearch" class="btn-secondary">重設</button>
        <button @click="fetchReports" class="btn-primary">查詢</button>
      </div>
    </div>

    <!-- 結果表格 -->
    <div class="bg-white rounded-lg shadow-sm border">
      <div v-if="isLoading" class="p-6 text-center">載入中...</div>
      <div v-else-if="error" class="p-6 text-center text-red-500">
        {{ error }}
      </div>
      <div
        v-else-if="reports.length === 0"
        class="p-6 text-center text-gray-500"
      >
        無符合條件的資料
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="th-cell">派工單號</th>
              <th class="th-cell">項目名稱</th>
              <th class="th-cell">日期</th>
              <th class="th-cell text-right">數量</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="report in reports" :key="report.RCid">
              <td class="td-cell">{{ report.派工單號 }}</td>
              <td class="td-cell">{{ report.項目名稱 }}</td>
              <td class="td-cell">{{ formatDate(report.日期) }}</td>
              <td class="td-cell text-right">
                {{ formatNumber(report.數量) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 分頁 -->
      <div
        v-if="totalPages > 1"
        class="p-4 flex items-center justify-between border-t"
      >
        <div class="flex items-center space-x-4">
          <span class="text-sm text-gray-600">
            共 {{ totalItems }} 筆資料
          </span>
          <span class="text-sm text-gray-800 font-medium">
            總數量：{{ formatNumber(totalAmount) }}
          </span>
        </div>
        <div class="flex items-center space-x-2">
          <button
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="pagination-btn"
          >
            <
          </button>
          <span class="text-sm"> {{ currentPage }} / {{ totalPages }} </span>
          <button
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="pagination-btn"
          >
            >
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useDateHelper } from '~/composables/useDateHelper';

const reports = ref([]);
const currentPage = ref(1);
const totalPages = ref(1);
const totalItems = ref(0);
const totalAmount = ref(0);
const isLoading = ref(false);
const error = ref(null);

const searchParams = ref({
  dispatchOrderNumber: '',
  itemName: '',
  startDate: '',
  endDate: '',
});

const fetchReports = async () => {
  isLoading.value = true;
  error.value = null;
  try {
    const query = {
      page: currentPage.value,
      limit: 10,
      ...searchParams.value,
    };

    const response = await $fetch('/api/road-construction/reports', {
      query,
    });

    reports.value = response.data;
    totalPages.value = response.totalPages;
    totalItems.value = response.total;
    totalAmount.value = response.totalAmount;
  } catch (e) {
    error.value = '讀取報表資料失敗，請稍後再試。';
    console.error(e);
  } finally {
    isLoading.value = false;
  }
};

const resetSearch = () => {
  searchParams.value = {
    dispatchOrderNumber: '',
    itemName: '',
    startDate: '',
    endDate: '',
  };
  fetchReports();
};

const changePage = (page) => {
  if (page > 0 && page <= totalPages.value) {
    currentPage.value = page;
    fetchReports();
  }
};

const { toLocalDate } = useDateHelper();

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return toLocalDate(date);
};

const formatNumber = (num) => {
  if (typeof num !== 'number') return num;
  return num.toLocaleString();
};

onMounted(fetchReports);
</script>

<style scoped>
.form-input {
  @apply block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm;
}
.btn-primary {
  @apply inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500;
}
.btn-secondary {
  @apply inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500;
}
.th-cell {
  @apply px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider;
}
.td-cell {
  @apply px-6 py-4 whitespace-nowrap text-sm text-gray-700;
}
.pagination-btn {
  @apply px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed;
}
</style>
