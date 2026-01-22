<template>
  <div class="space-y-6">
    <!-- 篩選與控制區域 -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <!-- 日期篩選 -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            開始日期
          </label>
          <input
            v-model="filters.startDate"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            結束日期
          </label>
          <input
            v-model="filters.endDate"
            type="date"
            class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <!-- 單位篩選 -->
        <div class="col-span-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            單位篩選
          </label>
          <div class="flex gap-4 pt-2">
            <label
              v-for="unit in availableUnits"
              :key="unit"
              class="flex items-center cursor-pointer"
            >
              <input
                type="checkbox"
                :value="unit"
                v-model="filters.selectedUnits"
                class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span class="ml-2 text-sm text-gray-700">{{ unit }}</span>
            </label>
          </div>
        </div>
      </div>

      <div class="flex justify-between items-center">
        <div class="text-sm text-gray-500">
          共 {{ totalRecords }} 筆資料
        </div>
        <div class="flex space-x-2">
          <button
            @click="clearFilters"
            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            清除篩選
          </button>
          <button
            @click="fetchRecords"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            查詢
          </button>
        </div>
      </div>
    </div>

    <!-- 視圖切換按鈕 -->
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="border-b">
        <nav class="flex">
          <button
            @click="currentView = 'quantity'"
            :class="[
              'flex-1 py-4 px-6 text-center font-medium text-sm transition-colors',
              currentView === 'quantity'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
            ]"
          >
            數量視圖
          </button>
          <button
            @click="currentView = 'amount'"
            :class="[
              'flex-1 py-4 px-6 text-center font-medium text-sm transition-colors',
              currentView === 'amount'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
            ]"
          >
            金額視圖
          </button>
          <button
            @click="currentView = 'pivot'"
            :class="[
              'flex-1 py-4 px-6 text-center font-medium text-sm transition-colors',
              currentView === 'pivot'
                ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50',
            ]"
          >
            樞紐分析
          </button>
        </nav>
      </div>

      <!-- 視圖內容區 -->
      <div class="p-6">
        <!-- 載入中 -->
        <div v-if="loading" class="flex justify-center items-center py-12">
          <div
            class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
          ></div>
          <span class="ml-3 text-gray-600">載入中...</span>
        </div>

        <!-- 無資料 -->
        <div
          v-else-if="filteredRecords.length === 0"
          class="text-center py-12 text-gray-500"
        >
          <svg
            class="mx-auto h-12 w-12 text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            ></path>
          </svg>
          <p>目前沒有資料，請先新增施工記錄</p>
        </div>

        <!-- 數量視圖 -->
        <QuantityView
          v-else-if="currentView === 'quantity' && constructionItems.length > 0"
          :records="filteredRecords"
          :items="constructionItems"
          @update="handleUpdateRecord"
          @delete="handleDeleteRecord"
        />

        <!-- 金額視圖 -->
        <AmountView
          v-else-if="currentView === 'amount' && constructionItems.length > 0"
          :records="filteredRecords"
          :items="constructionItems"
        />

        <!-- 樞紐分析視圖 -->
        <PivotView
          v-else-if="currentView === 'pivot' && constructionItems.length > 0"
          :records="filteredRecords"
          :items="constructionItems"
        />
      </div>
    </div>

    <!-- 操作按鈕 -->
    <div class="flex justify-between items-center">
      <button
        @click="showAddRecordModal = true"
        class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center space-x-2"
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
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          ></path>
        </svg>
        <span>新增日期記錄</span>
      </button>

      <button
        @click="exportToExcel"
        :disabled="filteredRecords.length === 0"
        class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2"
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
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          ></path>
        </svg>
        <span>匯出 Excel</span>
      </button>
    </div>

    <!-- 新增記錄 Modal -->
    <AddRecordModal
      v-if="showAddRecordModal"
      :available-units="availableUnits"
      @close="showAddRecordModal = false"
      @save="handleAddRecord"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from '~/composables/useToast';
import * as XLSX from 'xlsx';

// 引入子元件
import QuantityView from './ConstructionPivot/QuantityView.vue';
import AmountView from './ConstructionPivot/AmountView.vue';
import PivotView from './ConstructionPivot/PivotView.vue';
import AddRecordModal from './ConstructionPivot/AddRecordModal.vue';

const { success, error } = useToast();

// 狀態
const currentView = ref('quantity');
const loading = ref(false);
const records = ref([]);
const showAddRecordModal = ref(false);

// 施工項目配置（從資料庫動態載入）
const constructionItems = ref([]);
const availableUnits = ['工務所', '二標', '四標'];

// 項目名稱轉欄位名稱的對應（向後兼容）
const getFieldNameFromItemName = (itemName) => {
  const mapping = {
    '拖車租工': '拖車租工_數量',
    '台北市.拖車運費': '台北市拖車運費_數量',
    '台北市.瀝青渣運費(拖)': '台北市瀝青渣運費_數量',
    '補運費(拖車)': '補運費拖車_數量',
    '補單趟運費(拖車)': '補單趟運費拖車_數量',
    '補拖車移點運費': '補拖車移點運費_數量',
    '板橋.拖車運費': '板橋拖車運費_數量',
    '瀝青渣': '瀝青渣_數量',
    '瀝青渣(超大塊)': '瀝青渣超大塊_數量',
    '瀝青渣(廢土.級配)': '瀝青渣廢土級配_數量',
    '泡沫瀝青': '泡沫瀝青_數量',
    '3/8(三)瀝青混凝土': '三分之八三瀝青混凝土_數量',
    '3/8(四)瀝青混凝土': '三分之八四瀝青混凝土_數量',
    '改質 瀝青四-F': '改質瀝青四F_數量',
    '冷油(大桶)': '冷油大桶_數量',
  };
  return mapping[itemName] || `${itemName}_數量`;
};

// 篩選條件
const filters = ref({
  startDate: '',
  endDate: '',
  selectedUnits: [...availableUnits],
});

// 計算屬性
const filteredRecords = computed(() => {
  let result = [...records.value];

  // 按單位篩選
  if (filters.value.selectedUnits.length > 0) {
    result = result.filter((r) =>
      filters.value.selectedUnits.includes(r.單位)
    );
  }

  // 按日期篩選
  if (filters.value.startDate) {
    result = result.filter((r) => r.日期 >= filters.value.startDate);
  }

  if (filters.value.endDate) {
    result = result.filter((r) => r.日期 <= filters.value.endDate);
  }

  return result;
});

const totalRecords = computed(() => filteredRecords.value.length);

// 方法
const fetchRecords = async () => {
  loading.value = true;
  try {
    const params = {
      startDate: filters.value.startDate,
      endDate: filters.value.endDate,
      limit: 1000,
    };

    const response = await $fetch('/api/construction/records', { query: params });
    records.value = response.data;
  } catch (err) {
    console.error('載入資料失敗:', err);
    error('載入資料失敗');
  } finally {
    loading.value = false;
  }
};

const clearFilters = () => {
  filters.value = {
    startDate: '',
    endDate: '',
    selectedUnits: [...availableUnits],
  };
  fetchRecords();
};

const handleAddRecord = async (newRecord) => {
  try {
    await $fetch('/api/construction/records', {
      method: 'POST',
      body: newRecord,
    });

    success('新增成功');
    showAddRecordModal.value = false;
    await fetchRecords();
  } catch (err) {
    console.error('新增失敗:', err);
    error('新增失敗');
  }
};

const handleUpdateRecord = async (record) => {
  try {
    await $fetch(`/api/construction/records/${record.DCRid}`, {
      method: 'PUT',
      body: record,
    });

    success('更新成功');
    await fetchRecords();
  } catch (err) {
    console.error('更新失敗:', err);
    error('更新失敗');
  }
};

const handleDeleteRecord = async (id) => {
  if (!confirm('確定要刪除這筆記錄嗎？')) return;

  try {
    await $fetch(`/api/construction/records/${id}`, {
      method: 'DELETE',
    });

    success('刪除成功');
    await fetchRecords();
  } catch (err) {
    console.error('刪除失敗:', err);
    error('刪除失敗');
  }
};

const exportToExcel = () => {
  try {
    const wb = XLSX.utils.book_new();

    // === 工作表1：數量視圖 ===
    const quantityData = filteredRecords.value.map((r) => {
      const row = { 單位: r.單位, 日期: formatDate(r.日期) };
      constructionItems.value.forEach((item) => {
        row[`${item.name}(${item.unit})`] = r[item.field] || 0;
      });
      return row;
    });
    const ws1 = XLSX.utils.json_to_sheet(quantityData);
    XLSX.utils.book_append_sheet(wb, ws1, '數量視圖');

    // === 工作表2：金額視圖 ===
    const amountData = filteredRecords.value.map((r) => {
      const row = { 單位: r.單位, 日期: formatDate(r.日期) };
      let total = 0;

      constructionItems.value.forEach((item) => {
        const quantity = r[item.field] || 0;
        const amount = quantity * item.price;
        row[item.name] = amount;
        total += amount;
      });

      row['加總額'] = total;
      return row;
    });
    const ws2 = XLSX.utils.json_to_sheet(amountData);
    XLSX.utils.book_append_sheet(wb, ws2, '金額視圖');

    // === 工作表3：樞紐分析 ===
    const pivotExportData = [];

    // 按單位分組
    const groupedByUnit = {};
    filteredRecords.value.forEach((record) => {
      const unit = record.單位 || '未分類';
      if (!groupedByUnit[unit]) {
        groupedByUnit[unit] = [];
      }
      groupedByUnit[unit].push(record);
    });

    Object.entries(groupedByUnit).forEach(([unit, items]) => {
      // 單位總計
      const totalRow = { 單位: unit, 日期: '' };

      constructionItems.value.forEach((item) => {
        const totalQuantity = items.reduce(
          (sum, r) => sum + (r[item.field] || 0),
          0
        );
        const totalAmount = totalQuantity * item.price;
        totalRow[`${item.name}_數量`] = totalQuantity;
        totalRow[`${item.name}_金額`] = totalAmount;
      });

      const grandTotal = constructionItems.value.reduce((sum, item) => {
        return sum + totalRow[`${item.name}_金額`];
      }, 0);
      totalRow['加總額'] = grandTotal;

      pivotExportData.push(totalRow);

      // 明細
      const byDate = {};
      items.forEach((record) => {
        const date = record.日期;
        if (!byDate[date]) {
          byDate[date] = [];
        }
        byDate[date].push(record);
      });

      Object.entries(byDate)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .forEach(([date, dateItems]) => {
          const detailRow = { 單位: '', 日期: formatDate(date) };

          constructionItems.value.forEach((item) => {
            const qty = dateItems.reduce(
              (sum, r) => sum + (r[item.field] || 0),
              0
            );
            detailRow[`${item.name}_數量`] = qty;
            detailRow[`${item.name}_金額`] = qty * item.price;
          });

          pivotExportData.push(detailRow);
        });
    });

    const ws3 = XLSX.utils.json_to_sheet(pivotExportData);
    XLSX.utils.book_append_sheet(wb, ws3, '樞紐分析');

    // 下載
    const filename = `施工日報_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);

    success('Excel 匯出成功');
  } catch (err) {
    console.error('Excel 匯出失敗:', err);
    error('Excel 匯出失敗');
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

// 載入施工項目清單
const fetchItems = async () => {
  try {
    const response = await $fetch('/api/construction/items', {
      query: { activeOnly: 'true' },
    });
    
    // 轉換成前端需要的格式（向後兼容）
    constructionItems.value = response.data.map((item) => ({
      name: item.ItemName,
      field: getFieldNameFromItemName(item.ItemName),
      unit: item.Unit,
      price: item.Price,
      itemId: item.ItemId,
    }));
  } catch (err) {
    console.error('載入項目清單失敗:', err);
    error('載入項目清單失敗');
  }
};

// 生命週期
onMounted(async () => {
  // 設定預設日期範圍（本月）
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  filters.value.startDate = firstDay.toISOString().split('T')[0];
  filters.value.endDate = today.toISOString().split('T')[0];

  // 先載入項目清單，再載入記錄
  await fetchItems();
  await fetchRecords();
});
</script>
