<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 簡單的頂部導航 -->
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-6xl mx-auto px-4 py-4">
        <div class="flex justify-between items-center">
          <!-- Logo -->
          <div class="flex items-center space-x-3">
            <SaintDongLogo :size="100" variant="blue" />
            <span class="text-lg font-semibold text-gray-800"
              >企業管理平台</span
            >
          </div>

          <!-- 部門切換 -->
          <div class="flex space-x-1">
            <NuxtLink
              to="/road-construction"
              class="px-4 py-2 rounded-md text-sm font-medium"
              :class="
                isActive('/road-construction')
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              道路施工部
            </NuxtLink>
            <NuxtLink
              to="/finance"
              class="px-4 py-2 rounded-md text-sm font-medium"
              :class="
                isActive('/finance')
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              財務部
            </NuxtLink>
            <NuxtLink
              to="/hr"
              class="px-4 py-2 rounded-md text-sm font-medium"
              :class="
                isActive('/hr')
                  ? 'bg-green-100 text-green-700'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              管理部
            </NuxtLink>
            <NuxtLink
              to="/mis"
              class="px-4 py-2 rounded-md text-sm font-medium"
              :class="
                isActive('/mis')
                  ? 'bg-purple-100 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              MIS部
            </NuxtLink>
          </div>
        </div>
      </div>
    </nav>

    <!-- 主要內容 -->
    <main>
      <slot />
    </main>

    <!-- Toast 通知 -->
    <Toast />
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router';

const route = useRoute();

const isActive = (path) => {
  return route.path === path || route.path.startsWith(path + '/');
};
</script>
