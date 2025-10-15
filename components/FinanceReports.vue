<template>
  <div class="space-y-6">
    <!-- 篩選區域 -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >表單編號</label
          >
          <input
            v-model="filters.表單編號"
            type="text"
            placeholder="輸入表單編號"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >表單狀態</label
          >
          <select
            v-model="filters.表單狀態"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部</option>
            <option value="已核准">已核准</option>
            <option value="待簽核">待簽核</option>
            <option value="已刪除">已刪除</option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >申請人</label
          >
          <input
            v-model="filters.申請人"
            type="text"
            placeholder="輸入申請人姓名"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1"
            >申請日期</label
          >
          <input
            v-model="filters.申請日期"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-500">
          共 {{ totalReports }} 筆，總金額 TWD {{ formatCurrency(totalAmount) }}
        </div>
        <div class="flex space-x-2">
          <button
            @click="clearFilters"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            清除篩選
          </button>
          <button
            @click="searchReports"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            搜尋
          </button>
        </div>
      </div>
    </div>

    <!-- 報表列表 -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="overflow-x-auto">
        <table
          class="w-full divide-y divide-gray-200"
          style="min-width: 1200px"
        >
          <thead class="bg-gray-50">
            <tr>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 60px"
              >
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 140px"
              >
                表單編號
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 100px"
              >
                表單狀態
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 120px"
              >
                申請人
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 250px"
              >
                事由
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 300px"
              >
                請款原因
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 120px"
              >
                金額
              </th>
              <th
                class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                style="width: 110px"
              >
                申請日期
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="report in reports"
              :key="report.EFid"
              class="hover:bg-gray-50"
            >
              <td class="px-3 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td class="px-3 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ report.表單編號 }}
                </div>
                <div class="text-sm text-gray-500">{{ report.表單種類 }}</div>
              </td>
              <td class="px-3 py-4 whitespace-nowrap">
                <StatusBadge :status="report.表單狀態" />
              </td>
              <td class="px-3 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ report.申請人姓名 }}
                </div>
                <div
                  class="text-sm text-gray-500 truncate"
                  :title="report.申請人部門"
                >
                  {{ report.申請人部門 }}
                </div>
              </td>
              <td class="px-3 py-4 whitespace-nowrap">
                <div
                  class="text-sm text-gray-900 truncate"
                  :title="report.事由"
                >
                  {{ report.事由 || '-' }}
                </div>
              </td>
              <td class="px-3 py-4 whitespace-nowrap">
                <div
                  class="text-sm text-gray-900 truncate"
                  :title="report['請款原因-表單下方選項']"
                >
                  {{ report['請款原因-表單下方選項'] || '-' }}
                </div>
              </td>
              <td class="px-3 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ formatCurrency(report.表單本幣總計) }}
                </div>
                <div class="text-sm text-gray-500">
                  {{ report.項目本幣幣別 }}
                </div>
              </td>
              <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                {{ formatDate(report.申請日期) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 載入狀態 -->
      <div v-if="loading" class="flex justify-center items-center py-8">
        <div
          class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
        ></div>
        <span class="ml-2 text-gray-600">載入中...</span>
      </div>

      <!-- 分頁 -->
      <div
        class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6"
      >
        <div class="flex-1 flex justify-between sm:hidden">
          <button
            @click="previousPage"
            :disabled="currentPage === 1"
            class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            上一頁
          </button>
          <button
            @click="nextPage"
            :disabled="currentPage === totalPages"
            class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            下一頁
          </button>
        </div>
        <div
          class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-sm text-gray-700">
              顯示第 {{ (currentPage - 1) * pageSize + 1 }} 到
              {{ Math.min(currentPage * pageSize, totalReports) }} 筆，共
              {{ totalReports }} 筆
            </p>
          </div>
          <div>
            <nav
              class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
            >
              <!-- 第一頁按鈕 -->
              <button
                @click="goToFirstPage"
                :disabled="currentPage === 1"
                class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span class="sr-only">第一頁</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M15.707 15.707a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 010 1.414zm-6 0a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 1.414L5.414 10l4.293 4.293a1 1 0 010 1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
              <!-- 上一頁按鈕 -->
              <button
                @click="previousPage"
                :disabled="currentPage === 1"
                class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span class="sr-only">上一頁</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
              <button
                v-for="page in visiblePages"
                :key="page"
                @click="goToPage(page)"
                :class="[
                  'relative inline-flex items-center px-4 py-2 border text-sm font-medium',
                  page === currentPage
                    ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50',
                ]"
              >
                {{ page }}
              </button>
              <!-- 下一頁按鈕 -->
              <button
                @click="nextPage"
                :disabled="currentPage === totalPages"
                class="relative inline-flex items-center px-2 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span class="sr-only">下一頁</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
              <!-- 最後一頁按鈕 -->
              <button
                @click="goToLastPage"
                :disabled="currentPage === totalPages"
                class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                <span class="sr-only">最後一頁</span>
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M10.293 15.707a1 1 0 010-1.414L14.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0zm-6 0a1 1 0 010-1.414L8.586 10l-4.293-4.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

// 響應式資料
const reports = ref([]);
const loading = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
const totalReports = ref(0);
const totalAmount = ref(0);

// 篩選條件
const filters = ref({
  表單編號: '',
  表單狀態: '',
  申請人: '',
  申請日期: '',
});

// 計算屬性
const totalPages = computed(() =>
  Math.ceil(totalReports.value / pageSize.value)
);

const visiblePages = computed(() => {
  const pages = [];
  const start = Math.max(1, currentPage.value - 2);
  const end = Math.min(totalPages.value, start + 4);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

// 方法
const fetchReports = async () => {
  loading.value = true;
  try {
    const response = await $fetch('/api/finance/reports', {
      query: {
        page: currentPage.value,
        pageSize: pageSize.value,
        ...filters.value,
      },
    });

    reports.value = response.data;
    totalReports.value = response.total;
    totalAmount.value = response.totalAmount;
  } catch (error) {
    console.error('取得報表失敗:', error);
  } finally {
    loading.value = false;
  }
};

const searchReports = () => {
  currentPage.value = 1;
  fetchReports();
};

const clearFilters = () => {
  filters.value = {
    表單編號: '',
    表單狀態: '',
    申請人: '',
    申請日期: '',
  };
  searchReports();
};

const previousPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    fetchReports();
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++;
    fetchReports();
  }
};

const goToPage = (page) => {
  currentPage.value = page;
  fetchReports();
};

const goToFirstPage = () => {
  currentPage.value = 1;
  fetchReports();
};

const goToLastPage = () => {
  currentPage.value = totalPages.value;
  fetchReports();
};

const formatCurrency = (amount) => {
  if (!amount) return '0.00';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('zh-TW');
};

// 生命週期
onMounted(() => {
  fetchReports();
});
</script>
