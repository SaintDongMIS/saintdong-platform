<template>
  <div class="space-y-6">
    <FinanceBankWireExportLogPanel
      ref="historyPanelRef"
      accent="violet"
      :initial-batch-type="''"
      title="匯款匯出紀錄"
    />

    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="text-center mb-8">
        <div
          class="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <svg
            class="w-8 h-8 text-violet-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">匯款事後登錄</h2>
        <p class="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
          國泰<strong>已匯完</strong>、當時未經平台產檔 → 在此補登
          <code class="text-xs bg-slate-100 px-1 rounded">BankWireExport_Log</code>。
          <span class="text-violet-700 font-medium">不產 TXT</span>，僅供查帳與防重複比對。
        </p>
      </div>

      <!-- 步驟指示 -->
      <ol class="grid gap-3 sm:grid-cols-3 mb-8">
        <li
          class="rounded-lg border px-3 py-2.5 text-xs"
          :class="step >= 1 ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 text-slate-500'"
        >
          <span class="font-semibold text-violet-800">1. 批次資訊</span>
          <p class="mt-0.5 text-slate-600">檔名、交易日、實際匯款時間</p>
        </li>
        <li
          class="rounded-lg border px-3 py-2.5 text-xs"
          :class="step >= 2 ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 text-slate-500'"
        >
          <span class="font-semibold text-violet-800">2. 貼上明細</span>
          <p class="mt-0.5 text-slate-600">戶名、金額、帳號、七碼…</p>
        </li>
        <li
          class="rounded-lg border px-3 py-2.5 text-xs"
          :class="step >= 3 ? 'border-violet-200 bg-violet-50/50' : 'border-slate-200 text-slate-500'"
        >
          <span class="font-semibold text-violet-800">3. 確認登錄</span>
          <p class="mt-0.5 text-slate-600">預覽後寫入資料庫</p>
        </li>
      </ol>

      <!-- 批次資訊 -->
      <section class="rounded-xl border border-slate-200 bg-slate-50/40 p-4 mb-6">
        <h3 class="text-sm font-semibold text-slate-800 mb-3">批次資訊</h3>
        <div class="grid gap-4 sm:grid-cols-3">
          <div class="sm:col-span-1">
            <label class="block text-xs font-medium text-gray-700 mb-1">
              來源檔名 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="sourceFilename"
              type="text"
              placeholder="例：廠商_20260616.txt"
              class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">
              預定交易日期 <span class="text-red-500">*</span>
            </label>
            <input
              v-model="scheduledDateInput"
              type="date"
              class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 mb-1">
              實際匯款／登錄時間
              <span class="text-slate-400 font-normal">（選填）</span>
            </label>
            <input
              v-model="exportedAtInput"
              type="datetime-local"
              class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
            />
          </div>
        </div>
      </section>

      <!-- 貼上明細 -->
      <section class="mb-6">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h3 class="text-sm font-semibold text-slate-800">明細貼上</h3>
          <button
            type="button"
            class="text-xs font-medium text-violet-700 hover:text-violet-900 px-2 py-1 rounded-md hover:bg-violet-50"
            @click="loadExample"
          >
            載入範例
          </button>
        </div>
        <p class="text-xs text-slate-600 mb-2 leading-relaxed">
          Tab 或逗號分隔；第一列可為標題。欄位：
          <strong>戶名、金額、帳號</strong>（必填），
          <strong>七碼、事由、表單編號</strong>（選填）。
          系統會自動比對收款帳號清單補齊分行。
        </p>
        <textarea
          v-model="pasteText"
          rows="8"
          class="w-full text-xs font-mono border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 outline-none"
          placeholder="從 Excel 複製貼上…"
          @input="step = Math.max(step, 2)"
        />
        <div class="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            :disabled="previewLoading || !pasteText.trim()"
            @click="runPreview"
          >
            {{ previewLoading ? '解析中…' : '解析並預覽' }}
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
            @click="clearForm"
          >
            清除
          </button>
        </div>
      </section>

      <div
        v-if="previewError"
        class="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900"
        role="alert"
      >
        {{ previewError }}
      </div>

      <!-- 預覽 -->
      <section v-if="previewRows.length > 0" class="space-y-4">
        <div class="flex flex-wrap gap-2 text-xs">
          <span class="rounded-full bg-violet-100 text-violet-900 px-3 py-1 font-medium">
            預覽 {{ previewRows.length }} 筆
          </span>
          <span
            v-if="parseSkipped > 0"
            class="rounded-full bg-rose-100 text-rose-800 px-3 py-1"
          >
            略過 {{ parseSkipped }} 列
          </span>
          <span
            v-if="duplicateCount > 0"
            class="rounded-full bg-amber-100 text-amber-900 px-3 py-1 font-medium"
          >
            與紀錄重複 {{ duplicateCount }} 筆（仍可登錄，請確認）
          </span>
          <span class="rounded-full bg-slate-100 text-slate-700 px-3 py-1">
            合計 {{ totalAmountDisplay }}
          </span>
        </div>

        <div
          v-if="duplicateCount > 0"
          class="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950"
        >
          部分列與既有 log 相同（帳號＋金額＋戶名）。事後登錄允許重複寫入，但請確認不是誤登。
        </div>

        <div class="overflow-x-auto rounded-lg border border-violet-100">
          <table class="min-w-[960px] w-full text-xs text-left">
            <thead class="bg-violet-50 text-violet-950 font-semibold border-b border-violet-100">
              <tr>
                <th class="px-2 py-2">#</th>
                <th class="px-2 py-2">戶名</th>
                <th class="px-2 py-2">事由</th>
                <th class="px-2 py-2">七碼</th>
                <th class="px-2 py-2">帳號</th>
                <th class="px-2 py-2 text-right">金額</th>
                <th class="px-2 py-2 min-w-[10rem]">紀錄重複</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr
                v-for="row in previewRows"
                :key="'bf-prev-' + row.rowIndex"
                :class="duplicateForRow(row.rowIndex) ? 'bg-amber-50/50' : ''"
              >
                <td class="px-2 py-2 tabular-nums">{{ row.rowIndex + 1 }}</td>
                <td class="px-2 py-2">{{ row.payeeName }}</td>
                <td class="px-2 py-2 max-w-[8rem] truncate" :title="row.lineNote || ''">
                  {{ row.lineNote || '—' }}
                </td>
                <td class="px-2 py-2 font-mono">{{ row.payeeBankCode7 || '—' }}</td>
                <td class="px-2 py-2 font-mono">{{ row.payeeAccountDigits }}</td>
                <td class="px-2 py-2 text-right tabular-nums">{{ row.amountDisplay }}</td>
                <td class="px-2 py-2">
                  <template v-if="duplicateForRow(row.rowIndex)">
                    <span
                      class="inline-flex text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                      :class="
                        duplicateForRow(row.rowIndex)?.tier === 'strong'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                      "
                    >
                      {{ duplicateForRow(row.rowIndex)?.tierLabel }}
                    </span>
                  </template>
                  <span v-else class="text-gray-400">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <button
          type="button"
          class="w-full py-3 rounded-lg text-sm font-semibold transition-colors"
          :class="
            submitDisabled
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
          "
          :disabled="submitDisabled"
          @click="runSubmit"
        >
          {{
            submitting
              ? '登錄中…'
              : `確認登錄 ${previewRows.length} 筆至資料庫`
          }}
        </button>
      </section>
    </div>

    <!-- 成功提示 -->
    <div
      v-if="lastSuccess"
      class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900"
      role="status"
    >
      <p class="font-semibold">事後登錄完成</p>
      <p class="mt-1 text-emerald-800">
        批次 <span class="font-mono text-xs">{{ lastSuccess.batchId }}</span>，
        共 {{ lastSuccess.rowCount }} 筆。上方紀錄表已更新，類型為「事後登錄」。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  BACKFILL_PASTE_EXAMPLE,
  parseBackfillPasteText,
} from '~/utils/backfillPasteParse';
import type { BankWireBackfillInputRow } from '~/utils/backfillPasteParse';
import { formatAmountCentsDisplay } from '~/utils/bankWireExportLogDisplay';
import { useToast } from '~/composables/useToast';

const API_PREVIEW = '/api/bank-wire-export-log/backfill/preview';
const API_BACKFILL = '/api/bank-wire-export-log/backfill';

interface PreviewRowDto {
  rowIndex: number;
  payeeName: string;
  payeeAccountDigits: string;
  payeeBankCode7: string | null;
  lineNote: string | null;
  amountCents: number;
  amountDisplay: string;
}

interface DuplicateMatchDto {
  rowIndex: number;
  tier: 'strong' | 'weak';
  tierLabel: string;
}

const { success, error: toastError } = useToast();

const historyPanelRef = ref<{
  refresh: () => Promise<void>;
  setBatchTypeFilter: (v: import('~/utils/bankWireExportLogDisplay').BankWireBatchTypeFilter) => void;
} | null>(null);
const step = ref(1);
const sourceFilename = ref('');
const scheduledDateInput = ref(todayInputValue());
const exportedAtInput = ref('');
const pasteText = ref('');
const parsedInputs = ref<BankWireBackfillInputRow[]>([]);
const parseSkipped = ref(0);
const previewRows = ref<PreviewRowDto[]>([]);
const duplicateMatches = ref<DuplicateMatchDto[]>([]);
const previewLoading = ref(false);
const previewError = ref('');
const submitting = ref(false);
const lastSuccess = ref<{ batchId: string; rowCount: number } | null>(null);

function todayInputValue(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function scheduledTxDateYmd(): string {
  return scheduledDateInput.value.replace(/-/g, '');
}

function exportedAtIso(): string | undefined {
  const v = exportedAtInput.value.trim();
  if (!v) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const duplicateCount = computed(() => duplicateMatches.value.length);

const totalAmountDisplay = computed(() => {
  const sum = previewRows.value.reduce((a, r) => a + (r.amountCents || 0), 0);
  return formatAmountCentsDisplay(sum);
});

const submitDisabled = computed(
  () =>
    submitting.value ||
    previewLoading.value ||
    previewRows.value.length === 0 ||
    !sourceFilename.value.trim() ||
    !/^\d{8}$/.test(scheduledTxDateYmd())
);

function duplicateForRow(rowIndex: number): DuplicateMatchDto | undefined {
  return duplicateMatches.value.find((m) => m.rowIndex === rowIndex);
}

function loadExample() {
  pasteText.value = BACKFILL_PASTE_EXAMPLE;
  if (!sourceFilename.value.trim()) {
    sourceFilename.value = `事後登錄_${scheduledTxDateYmd()}.txt`;
  }
  step.value = 2;
}

function clearForm() {
  pasteText.value = '';
  parsedInputs.value = [];
  parseSkipped.value = 0;
  previewRows.value = [];
  duplicateMatches.value = [];
  previewError.value = '';
  lastSuccess.value = null;
  step.value = 1;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      statusMessage?: string;
      message?: string;
    };
    return data.statusMessage || data.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function runPreview() {
  previewLoading.value = true;
  previewError.value = '';
  previewRows.value = [];
  duplicateMatches.value = [];
  lastSuccess.value = null;

  const parsed = parseBackfillPasteText(pasteText.value);
  if (!parsed.ok) {
    previewError.value = parsed.error;
    previewLoading.value = false;
    return;
  }

  parsedInputs.value = parsed.rows;
  parseSkipped.value = parsed.skipped;
  step.value = 3;

  if (!sourceFilename.value.trim()) {
    sourceFilename.value = `事後登錄_${scheduledTxDateYmd()}.txt`;
  }

  try {
    const r = await fetch(API_PREVIEW, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduledTxDateYmd: scheduledTxDateYmd(),
        rows: parsed.rows,
      }),
    });
    if (!r.ok) throw new Error(await readErrorMessage(r));

    const data = (await r.json()) as {
      rows?: PreviewRowDto[];
      duplicateMatches?: DuplicateMatchDto[];
    };
    previewRows.value = data.rows ?? [];
    duplicateMatches.value = data.duplicateMatches ?? [];
  } catch (e: unknown) {
    previewError.value = e instanceof Error ? e.message : '預覽失敗';
  } finally {
    previewLoading.value = false;
  }
}

async function runSubmit() {
  if (submitDisabled.value || parsedInputs.value.length === 0) return;

  const confirmed =
    duplicateCount.value === 0 ||
    window.confirm(
      `有 ${duplicateCount.value} 筆與既有紀錄重複，確定仍要登錄 ${previewRows.value.length} 筆？`
    );
  if (!confirmed) return;

  submitting.value = true;
  try {
    const body: Record<string, unknown> = {
      sourceFilename: sourceFilename.value.trim(),
      scheduledTxDateYmd: scheduledTxDateYmd(),
      rows: parsedInputs.value,
    };
    const exportedAt = exportedAtIso();
    if (exportedAt) body.exportedAt = exportedAt;

    const r = await fetch(API_BACKFILL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await readErrorMessage(r));

    const data = (await r.json()) as {
      batchId?: string;
      rowCount?: number;
    };
    lastSuccess.value = {
      batchId: data.batchId ?? '',
      rowCount: data.rowCount ?? previewRows.value.length,
    };
    success(`已登錄 ${lastSuccess.value.rowCount} 筆`);
    historyPanelRef.value?.setBatchTypeFilter('manual_backfill');
    pasteText.value = '';
    previewRows.value = [];
    duplicateMatches.value = [];
    parsedInputs.value = [];
    step.value = 1;
  } catch (e: unknown) {
    toastError(e instanceof Error ? e.message : '登錄失敗');
  } finally {
    submitting.value = false;
  }
}
</script>
