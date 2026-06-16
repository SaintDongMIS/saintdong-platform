<template>
  <div
    class="rounded-xl border overflow-hidden shadow-sm"
    :class="panelBorderClass"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
      :class="headerHoverClass"
      @click="open = !open"
    >
      <span class="flex items-center gap-2 text-sm font-semibold text-slate-800">
        <svg
          class="w-5 h-5 shrink-0"
          :class="iconClass"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {{ title }}
        <span class="text-xs font-normal text-slate-500">（BankWireExport_Log）</span>
      </span>
      <span class="flex items-center gap-2 shrink-0">
        <span
          v-if="rows.length > 0"
          class="text-xs tabular-nums rounded-full px-2 py-0.5"
          :class="countBadgeClass"
        >
          {{ rows.length }} 筆
        </span>
        <svg
          class="w-4 h-4 text-slate-400 transition-transform"
          :class="open ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </span>
    </button>

    <div v-show="open" class="border-t border-slate-100 px-3 pb-3 pt-3 space-y-3">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="opt in BANK_WIRE_BATCH_TYPE_OPTIONS"
            :key="opt.value || 'all'"
            type="button"
            class="text-xs font-medium px-2.5 py-1 rounded-full border transition-colors"
            :class="
              batchTypeFilter === opt.value
                ? activeFilterClass
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            "
            @click="setBatchTypeFilter(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <div class="relative flex-1 sm:w-52">
            <input
              v-model="searchInput"
              type="search"
              placeholder="搜尋戶名、表單、檔名…"
              class="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:ring-2 focus:outline-none"
              :class="searchFocusClass"
              @keydown.enter="applySearch"
            />
            <svg
              class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            type="button"
            class="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 shrink-0"
            :disabled="loading"
            @click="refresh"
          >
            {{ loading ? '載入中…' : '重新載入' }}
          </button>
        </div>
      </div>

      <div
        v-if="error"
        class="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800"
        role="alert"
      >
        {{ error }}
      </div>

      <div
        v-else-if="!loading && rows.length === 0"
        class="text-center text-sm text-slate-500 py-8 rounded-lg border border-dashed border-slate-200 bg-slate-50/50"
      >
        尚無符合條件的匯出紀錄
      </div>

      <div
        v-else
        class="overflow-x-auto rounded-lg border border-slate-200 bg-white"
        :class="compact ? 'max-h-52' : 'max-h-[28rem]'"
      >
        <table class="min-w-[1100px] w-full text-xs text-left">
          <thead
            class="sticky top-0 z-10 bg-slate-100/95 text-slate-700 font-semibold border-b border-slate-200 backdrop-blur-sm"
          >
            <tr>
              <th class="px-2 py-2 whitespace-nowrap">匯出時間</th>
              <th class="px-2 py-2">類型</th>
              <th class="px-2 py-2 whitespace-nowrap">交易日</th>
              <th class="px-2 py-2 text-center">已上傳</th>
              <th class="px-2 py-2">批次</th>
              <th class="px-2 py-2">檔名</th>
              <th class="px-2 py-2">戶名</th>
              <th class="px-2 py-2">事由</th>
              <th class="px-2 py-2">七碼</th>
              <th class="px-2 py-2">帳號</th>
              <th class="px-2 py-2">表單編號</th>
              <th class="px-2 py-2 text-center">合併#</th>
              <th class="px-2 py-2 text-right">金額</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="h in rows"
              :key="h.id"
              class="hover:bg-slate-50/80 transition-colors"
            >
              <td class="px-2 py-1.5 text-slate-600 whitespace-nowrap font-mono text-[10px]">
                {{ formatExportedAtTaipei(h.exportedAt) }}
              </td>
              <td class="px-2 py-1.5 whitespace-nowrap">
                <span
                  class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                  :class="batchTypeBadgeClass(h.batchType)"
                >
                  {{ batchTypeLabel(h.batchType) }}
                </span>
              </td>
              <td class="px-2 py-1.5 text-slate-600 whitespace-nowrap font-mono text-[10px]">
                {{ formatYmdDisplay(h.scheduledTxDate) }}
              </td>
              <td class="px-2 py-1.5 text-center">
                <span
                  v-if="h.alreadyUploaded"
                  class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800"
                  title="國泰已匯完或事後登錄"
                >
                  是
                </span>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td
                class="px-2 py-1.5 font-mono text-slate-700 text-[10px] max-w-[6.5rem] truncate"
                :title="h.batchId"
              >
                {{ h.batchId }}
              </td>
              <td
                class="px-2 py-1.5 text-slate-700 max-w-[8rem] truncate"
                :title="h.sourceFilename"
              >
                {{ h.sourceFilename }}
              </td>
              <td
                class="px-2 py-1.5 text-slate-800 max-w-[7rem] truncate font-medium"
                :title="h.payeeName"
              >
                {{ h.payeeName }}
              </td>
              <td
                class="px-2 py-1.5 text-slate-600 max-w-[8rem] truncate"
                :title="h.lineNote || ''"
              >
                {{ h.lineNote || '—' }}
              </td>
              <td class="px-2 py-1.5 font-mono text-slate-700">
                {{ h.payeeBankCode7 || '—' }}
              </td>
              <td class="px-2 py-1.5 font-mono text-slate-700">
                {{ h.payeeAccountDigits || '—' }}
              </td>
              <td class="px-2 py-1.5 font-mono text-slate-800 text-[10px] max-w-[6rem] truncate" :title="h.formNo">
                {{ h.formNo }}
              </td>
              <td class="px-2 py-1.5 text-center tabular-nums text-slate-600">
                {{ h.mergedLineIndex }}
              </td>
              <td class="px-2 py-1.5 text-right tabular-nums text-slate-900 font-medium whitespace-nowrap">
                {{ formatAmountCentsDisplay(h.amountCents) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  BANK_WIRE_BATCH_TYPE_OPTIONS,
  batchTypeBadgeClass,
  batchTypeLabel,
  buildBankWireLogListUrl,
  formatAmountCentsDisplay,
  formatExportedAtTaipei,
  formatYmdDisplay,
  type BankWireBatchTypeFilter,
  type BankWireExportLogRow,
} from '~/utils/bankWireExportLogDisplay';

const props = withDefaults(
  defineProps<{
    title?: string;
    accent?: 'green' | 'amber' | 'violet' | 'slate';
    defaultOpen?: boolean;
    compact?: boolean;
    initialBatchType?: BankWireBatchTypeFilter;
    limit?: number;
  }>(),
  {
    title: '匯款匯出紀錄',
    accent: 'slate',
    defaultOpen: true,
    compact: false,
    initialBatchType: '',
    limit: 200,
  }
);

const open = ref(props.defaultOpen);
const loading = ref(false);
const error = ref('');
const rows = ref<BankWireExportLogRow[]>([]);
const batchTypeFilter = ref<BankWireBatchTypeFilter>(props.initialBatchType);
const searchInput = ref('');
const appliedSearch = ref('');

const panelBorderClass = computed(() => {
  switch (props.accent) {
    case 'green':
      return 'border-emerald-100 bg-gradient-to-b from-emerald-50/40 to-white';
    case 'amber':
      return 'border-amber-100 bg-gradient-to-b from-amber-50/40 to-white';
    case 'violet':
      return 'border-violet-100 bg-gradient-to-b from-violet-50/40 to-white';
    default:
      return 'border-slate-200 bg-gradient-to-b from-slate-50/80 to-white';
  }
});

const headerHoverClass = computed(() => {
  switch (props.accent) {
    case 'green':
      return 'hover:bg-emerald-50/60';
    case 'amber':
      return 'hover:bg-amber-50/60';
    case 'violet':
      return 'hover:bg-violet-50/60';
    default:
      return 'hover:bg-slate-50/90';
  }
});

const iconClass = computed(() => {
  switch (props.accent) {
    case 'green':
      return 'text-emerald-600';
    case 'amber':
      return 'text-amber-600';
    case 'violet':
      return 'text-violet-600';
    default:
      return 'text-slate-500';
  }
});

const countBadgeClass = computed(() => {
  switch (props.accent) {
    case 'green':
      return 'bg-emerald-100 text-emerald-800';
    case 'amber':
      return 'bg-amber-100 text-amber-900';
    case 'violet':
      return 'bg-violet-100 text-violet-900';
    default:
      return 'bg-slate-100 text-slate-700';
  }
});

const activeFilterClass = computed(() => {
  switch (props.accent) {
    case 'green':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'amber':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'violet':
      return 'border-violet-300 bg-violet-50 text-violet-900';
    default:
      return 'border-slate-300 bg-slate-100 text-slate-900';
  }
});

const searchFocusClass = computed(() => {
  switch (props.accent) {
    case 'green':
      return 'focus:ring-emerald-200 focus:border-emerald-400';
    case 'amber':
      return 'focus:ring-amber-200 focus:border-amber-400';
    case 'violet':
      return 'focus:ring-violet-200 focus:border-violet-400';
    default:
      return 'focus:ring-slate-200 focus:border-slate-400';
  }
});

function setBatchTypeFilter(value: BankWireBatchTypeFilter) {
  batchTypeFilter.value = value;
  void refresh();
}

function applySearch() {
  appliedSearch.value = searchInput.value.trim();
  void refresh();
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
watch(searchInput, (val) => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    appliedSearch.value = val.trim();
    void refresh();
  }, 400);
});

async function refresh() {
  loading.value = true;
  error.value = '';
  try {
    const url = buildBankWireLogListUrl({
      limit: props.limit,
      batchType: batchTypeFilter.value,
      q: appliedSearch.value,
    });
    const r = await fetch(url);
    if (!r.ok) {
      const data = (await r.json().catch(() => ({}))) as {
        statusMessage?: string;
        message?: string;
      };
      throw new Error(data.statusMessage || data.message || `HTTP ${r.status}`);
    }
    const data = (await r.json()) as { rows?: BankWireExportLogRow[] };
    rows.value = data.rows ?? [];
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '載入失敗';
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void refresh();
});

defineExpose({
  refresh,
  setBatchTypeFilter,
});
</script>
