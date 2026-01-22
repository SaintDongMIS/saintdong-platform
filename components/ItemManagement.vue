<template>
  <div class="space-y-6">
    <!-- 標題與新增按鈕 -->
    <div class="flex justify-between items-center">
      <div>
        <h2 class="text-2xl font-bold text-gray-900">施工項目管理</h2>
        <p class="text-gray-600 mt-1">管理施工項目的名稱、單位、單價</p>
      </div>
      <button
        @click="showAddModal = true"
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
        <span>新增項目</span>
      </button>
    </div>

    <!-- 項目列表 -->
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div v-if="loading" class="flex justify-center items-center py-12">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"
        ></div>
        <span class="ml-3 text-gray-600">載入中...</span>
      </div>

      <table v-else class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              順序
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              項目名稱
            </th>
            <th
              class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              單位
            </th>
            <th
              class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              單價
            </th>
            <th
              class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              狀態
            </th>
            <th
              class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr
            v-for="item in items"
            :key="item.ItemId"
            :class="{ 'opacity-50': !item.IsActive }"
          >
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
              {{ item.DisplayOrder }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <div class="text-sm font-medium text-gray-900">
                {{ item.ItemName }}
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <span
                class="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded"
              >
                {{ item.Unit }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
              {{ formatCurrency(item.Price) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center">
              <span
                :class="[
                  'px-2 py-1 text-xs font-medium rounded',
                  item.IsActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800',
                ]"
              >
                {{ item.IsActive ? '啟用' : '停用' }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
              <button
                @click="editItem(item)"
                class="text-blue-600 hover:text-blue-900 mr-3"
              >
                編輯
              </button>
              <button
                v-if="item.IsActive"
                @click="toggleItemStatus(item)"
                class="text-yellow-600 hover:text-yellow-900 mr-3"
              >
                停用
              </button>
              <button
                v-else
                @click="toggleItemStatus(item)"
                class="text-green-600 hover:text-green-900 mr-3"
              >
                啟用
              </button>
              <button
                @click="deleteItem(item)"
                class="text-red-600 hover:text-red-900"
              >
                刪除
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯 Modal -->
    <ItemFormModal
      v-if="showAddModal || showEditModal"
      :item="editingItem"
      :is-edit-mode="showEditModal"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from '~/composables/useToast';
import ItemFormModal from './ItemManagement/ItemFormModal.vue';

const { success, error, warning } = useToast();

const loading = ref(false);
const items = ref([]);
const showAddModal = ref(false);
const showEditModal = ref(false);
const editingItem = ref(null);

const fetchItems = async () => {
  loading.value = true;
  try {
    const response = await $fetch('/api/construction/items');
    items.value = response.data;
  } catch (err) {
    console.error('載入項目失敗:', err);
    error('載入項目失敗');
  } finally {
    loading.value = false;
  }
};

const editItem = (item) => {
  editingItem.value = { ...item };
  showEditModal.value = true;
};

const closeModal = () => {
  showAddModal.value = false;
  showEditModal.value = false;
  editingItem.value = null;
};

const handleSave = async (itemData) => {
  try {
    if (showEditModal.value) {
      // 更新
      await $fetch(`/api/construction/items/${itemData.ItemId}`, {
        method: 'PUT',
        body: itemData,
      });
      success('更新成功');
    } else {
      // 新增
      await $fetch('/api/construction/items', {
        method: 'POST',
        body: itemData,
      });
      success('新增成功');
    }

    closeModal();
    await fetchItems();
  } catch (err) {
    console.error('儲存失敗:', err);
    error(err.message || '儲存失敗');
  }
};

const toggleItemStatus = async (item) => {
  const action = item.IsActive ? '停用' : '啟用';
  if (!confirm(`確定要${action}「${item.ItemName}」嗎？`)) return;

  try {
    await $fetch(`/api/construction/items/${item.ItemId}`, {
      method: 'PUT',
      body: { IsActive: !item.IsActive },
    });
    success(`${action}成功`);
    await fetchItems();
  } catch (err) {
    console.error(`${action}失敗:`, err);
    error(`${action}失敗`);
  }
};

const deleteItem = async (item) => {
  if (
    !confirm(
      `確定要刪除「${item.ItemName}」嗎？\n\n⚠️ 注意：如果此項目有歷史記錄，將無法刪除，請改用「停用」功能。`
    )
  )
    return;

  try {
    await $fetch(`/api/construction/items/${item.ItemId}`, {
      method: 'DELETE',
    });
    success('刪除成功');
    await fetchItems();
  } catch (err) {
    console.error('刪除失敗:', err);
    error(err.message || '刪除失敗');
  }
};

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '-';
  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

onMounted(() => {
  fetchItems();
});
</script>
