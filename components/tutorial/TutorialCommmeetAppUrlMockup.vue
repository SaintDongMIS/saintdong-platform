<script setup lang="ts">
withDefaults(
  defineProps<{
    companyUrl?: string;
  }>(),
  {
    companyUrl: 'bimgroup.commeet.co',
  },
);
</script>

<template>
  <div
    class="relative mx-auto w-[220px] select-none sm:w-[240px]"
    role="img"
    aria-label="COMMEET App 輸入企業網址畫面示意"
  >
    <!-- 手機外框 -->
    <div
      class="overflow-hidden rounded-[2rem] border-[3px] border-slate-800 bg-slate-800 shadow-lg"
    >
      <div class="bg-white px-4 pb-6 pt-10">
        <!-- Logo -->
        <div class="text-center">
          <span
            class="text-[1.65rem] font-extrabold tracking-tight text-slate-700"
            style="font-family: system-ui, -apple-system, sans-serif"
          >
            COM
          </span>
          <span
            class="text-[1.65rem] font-extrabold tracking-tight text-[#f05a28]"
            style="font-family: system-ui, -apple-system, sans-serif"
          >
            MEET
          </span>
        </div>

        <!-- 提示 -->
        <p class="mt-8 text-center text-[11px] text-slate-400">
          請輸入你的企業網址
        </p>

        <!-- 輸入列 -->
        <div
          class="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5"
        >
          <span
            class="min-w-0 flex-1 truncate text-left text-[11px] text-slate-600"
          >
            {{ companyUrl }}
          </span>
          <span
            class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f05a28] text-white shadow-sm"
            aria-hidden="true"
          >
            <svg
              class="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </span>
        </div>

        <!-- 頁尾 -->
        <div class="mt-16 space-y-1 text-center text-[8px] leading-relaxed text-slate-400">
          <p>COMMEET 全台首家費用管理系統</p>
          <p>為企業提供創新運營思維，以更有效率的模式管理費用</p>
          <p class="pt-1 text-slate-300">V 2.43.3</p>
        </div>
      </div>
    </div>

    <!-- 頂部聽筒裝飾 -->
    <div
      class="pointer-events-none absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-slate-700"
      aria-hidden="true"
    />
  </div>
</template>
