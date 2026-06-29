<template>
  <div class="min-h-screen bg-gray-50">
    <nav class="bg-white shadow-sm border-b">
      <div class="max-w-6xl mx-auto px-4 py-3 sm:py-4">
        <div class="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <!-- Logo -->
          <div class="flex items-center justify-between sm:justify-start sm:space-x-3">
            <div class="flex items-center space-x-2 sm:space-x-3">
              <SaintDongLogo :size="72" variant="blue" class="sm:hidden" />
              <SaintDongLogo :size="100" variant="blue" class="hidden sm:block" />
              <span class="text-base sm:text-lg font-semibold text-gray-800"
                >企業管理平台</span
              >
            </div>
          </div>

          <!-- 部門切換 -->
          <div class="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 sm:overflow-visible sm:pb-0">
            <NuxtLink
              to="/tutorial"
              class="shrink-0 px-3 sm:px-4 py-2 rounded-md text-sm font-medium"
              :class="
                isActive('/tutorial')
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-600 hover:bg-gray-100'
              "
            >
              教學中心
            </NuxtLink>
            <NuxtLink
              to="/road-construction"
              class="shrink-0 px-3 sm:px-4 py-2 rounded-md text-sm font-medium"
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
              class="shrink-0 px-3 sm:px-4 py-2 rounded-md text-sm font-medium"
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
              class="shrink-0 px-3 sm:px-4 py-2 rounded-md text-sm font-medium"
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
              class="shrink-0 px-3 sm:px-4 py-2 rounded-md text-sm font-medium"
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

    <main>
      <slot />
    </main>

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
