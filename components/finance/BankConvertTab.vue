<template>
  <div class="bg-white rounded-lg shadow-sm border p-6">
    <div class="text-center mb-6">
      <div
        class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <svg
          class="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          ></path>
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">網銀付款轉檔</h2>
      <p class="text-gray-600 text-sm sm:text-base max-w-xl mx-auto">
        上傳 Commeet 付款資料 Excel（.xlsx/.xls）；預覽依<strong>收款人戶名</strong>合併，與轉檔結果一致。曾匯出之表單預設不轉檔，可自行取消勾選。
      </p>
    </div>

    <!-- 匯出紀錄（僅讀取 DB，與預覽 state 分離） -->
    <div
      class="mt-5 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50/80 to-white overflow-hidden shadow-sm"
    >
      <button
        type="button"
        class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/90 transition-colors"
        @click="historyOpen = !historyOpen"
      >
        <span class="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <svg
            class="w-5 h-5 text-slate-500 shrink-0"
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
          最近匯出紀錄
          <span class="text-xs font-normal text-slate-500">（資料庫）</span>
        </span>
        <span class="text-slate-400 text-xs tabular-nums shrink-0">
          {{ historyRows.length }} 筆列
        </span>
      </button>
      <div
        v-show="historyOpen"
        class="border-t border-slate-100 px-3 pb-3 pt-2"
      >
        <div class="flex justify-end mb-2">
          <button
            type="button"
            class="text-xs font-medium text-green-700 hover:text-green-900 px-2 py-1 rounded-md hover:bg-green-50 transition-colors"
            :disabled="historyLoading"
            @click="refreshHistory"
          >
            {{ historyLoading ? '載入中…' : '重新載入' }}
          </button>
        </div>
        <div
          v-if="!historyLoading && historyRows.length === 0"
          class="text-center text-sm text-slate-500 py-6"
        >
          尚無匯出紀錄
        </div>
        <div
          v-else
          class="overflow-x-auto max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white"
        >
          <table class="min-w-[760px] w-full text-xs text-left">
            <thead class="sticky top-0 bg-slate-100/95 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th class="px-2 py-2 whitespace-nowrap">匯出時間</th>
                <th class="px-2 py-2">批次</th>
                <th class="px-2 py-2">檔名</th>
                <th class="px-2 py-2 text-center">合併序號</th>
                <th class="px-2 py-2">表單編號</th>
                <th class="px-2 py-2">戶名</th>
                <th class="px-2 py-2 text-right">金額</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="h in historyRows"
                :key="h.id"
                class="hover:bg-slate-50/80"
              >
                <td class="px-2 py-1.5 text-slate-600 whitespace-nowrap font-mono">
                  {{ formatExportedAt(h.exportedAt) }}
                </td>
                <td class="px-2 py-1.5 font-mono text-slate-700 text-[10px] max-w-[7rem] truncate" :title="h.batchId">
                  {{ h.batchId }}
                </td>
                <td class="px-2 py-1.5 text-slate-700 max-w-[10rem] truncate" :title="h.sourceFilename">
                  {{ h.sourceFilename }}
                </td>
                <td class="px-2 py-1.5 text-center tabular-nums">{{ h.mergedLineIndex }}</td>
                <td class="px-2 py-1.5 font-mono text-slate-800">{{ h.formNo }}</td>
                <td class="px-2 py-1.5 text-slate-800 max-w-[8rem] truncate" :title="h.payeeName">
                  {{ h.payeeName }}
                </td>
                <td class="px-2 py-1.5 text-right tabular-nums text-slate-900">
                  {{ formatCtsDisplay(h.amountCents) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <FileUploadZone
      :selected-file="upload.selectedFile.value"
      :is-drag-over="upload.isDragOver.value"
      accept=".xlsx,.xls"
      accept-text="支援 .xlsx、.xls"
      color="green"
      input-ref="bankConvertFileInput"
      file-input-id="bank-convert-file-input"
      @dragover="upload.isDragOver.value = true"
      @dragleave="upload.isDragOver.value = false"
      @drop="upload.handleFileDrop"
      @click="triggerFileInput"
      @change="upload.handleFileSelect"
      @clear="onClearFile"
    />

    <!-- 解析狀態 -->
    <div
      v-if="upload.selectedFile.value && isParsingPreview"
      class="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600"
    >
      <svg
        class="animate-spin h-5 w-5 text-green-600"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      正在解析預覽…
    </div>

    <div
      v-if="parseError"
      class="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900"
      role="alert"
    >
      {{ parseError }}
    </div>

    <div
      v-if="parseMeta && !parseError && previewRows.length > 0"
      class="mt-4 flex flex-wrap gap-3 text-xs sm:text-sm text-gray-600"
    >
      <span
        class="inline-flex items-center rounded-full bg-green-50 text-green-800 px-3 py-1 font-medium"
      >
        表單明細
        {{ previewRows.length }} 筆
      </span>
      <span
        v-if="willExportCount > 0"
        class="inline-flex items-center rounded-full bg-teal-50 text-teal-900 px-3 py-1 font-medium"
      >
        合併後網銀
        {{ mergedExportLineCount }} 筆
      </span>
      <span v-if="parseMeta.skippedNonWire > 0">
        已略過非匯款 {{ parseMeta.skippedNonWire }} 筆
      </span>
      <span v-if="parseMeta.skippedInvalid > 0" class="text-amber-700">
        匯款但欄位／金額異常已略過 {{ parseMeta.skippedInvalid }} 筆
      </span>
      <span v-if="excludedCount > 0" class="text-gray-700">
        本次不轉檔 {{ excludedCount }} 筆
      </span>
      <span
        v-if="previouslyExportedInFileCount > 0"
        class="inline-flex items-center rounded-full bg-amber-50 text-amber-900 px-3 py-1 font-medium"
      >
        檔內曾匯出過 {{ previouslyExportedInFileCount }} 筆（預設不轉）
      </span>
    </div>

    <!-- 合併後預覽（戶名相同 → 一筆網銀列，合併序號 1、2、3…） -->
    <div
      v-if="mergedPreviewGroups.length > 0 && !parseError"
      class="mt-4 rounded-lg border border-teal-200 overflow-hidden"
    >
      <div
        class="px-3 py-2 bg-teal-50 border-b border-teal-100 text-xs text-teal-900 font-medium"
      >
        合併預覽（未勾選「不轉檔」之表單；同一收款人戶名加總為一筆）
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-[520px] w-full text-sm text-left border-collapse">
          <thead class="bg-teal-50/80 border-b border-teal-100">
            <tr>
              <th class="px-3 py-2.5 font-semibold text-teal-900 whitespace-nowrap">
                合併序號
              </th>
              <th class="px-3 py-2.5 font-semibold text-teal-900 min-w-[8rem]">
                收款人戶名
              </th>
              <th class="px-3 py-2.5 font-semibold text-teal-900 text-right whitespace-nowrap">
                加總金額
              </th>
              <th class="px-3 py-2.5 font-semibold text-teal-900 whitespace-nowrap">
                手續費
              </th>
              <th class="px-3 py-2.5 font-semibold text-teal-900 text-right whitespace-nowrap">
                含表單數
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-teal-50">
            <tr
              v-for="g in mergedPreviewGroups"
              :key="'merge-' + g.mergedLineIndex"
              class="bg-white hover:bg-teal-50/40"
            >
              <td class="px-3 py-2.5 tabular-nums font-medium text-teal-800">
                {{ g.mergedLineIndex }}
              </td>
              <td class="px-3 py-2.5 text-gray-900">{{ g.payeeName }}</td>
              <td class="px-3 py-2.5 text-right tabular-nums text-gray-900">
                {{ g.totalAmountDisplay }}
              </td>
              <td class="px-3 py-2.5 text-gray-800 whitespace-nowrap text-xs sm:text-sm">
                {{ g.feeDisplay }}
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums text-gray-600">
                {{ g.formCount }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="willExportCount === 0 && previewRows.length > 0 && !parseError"
      class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      已將所有表單設為不轉檔，無合併預覽；請取消勾選或重新選檔。
    </div>

    <!-- 表單明細 -->
    <div
      v-if="previewRows.length > 0 && !parseError"
      class="mt-4 rounded-lg border border-gray-200 overflow-hidden"
    >
      <div
        class="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500"
      >
        表單明細：勾選「不轉檔」排除；標示「曾匯出」者已見於資料庫紀錄，預設不納入本次轉檔。
      </div>
      <div class="overflow-x-auto max-h-[min(32rem,55vh)] overflow-y-auto">
        <table class="min-w-[920px] w-full text-sm text-left border-collapse">
          <thead
            class="sticky top-0 z-10 bg-emerald-50/95 backdrop-blur-sm border-b border-emerald-100"
          >
            <tr>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap w-10"
                scope="col"
              >
                不轉檔
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap"
                scope="col"
              >
                序號
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 min-w-[10rem]"
                scope="col"
              >
                表單編號
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 min-w-[11rem]"
                scope="col"
              >
                收款行庫
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap"
                scope="col"
              >
                收款人帳號
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 min-w-[8rem]"
                scope="col"
              >
                收款人戶名
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap"
                scope="col"
              >
                收款人統編
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap text-right"
                scope="col"
              >
                金額
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap"
                scope="col"
              >
                手續費
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 whitespace-nowrap text-right"
                scope="col"
              >
                月結手續費
              </th>
              <th
                class="px-2 py-2.5 font-semibold text-emerald-900 min-w-[10rem]"
                scope="col"
              >
                收款人存摺備註
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="row in previewRows"
              :key="'bank-preview-' + row.serial"
              :class="row.excludeFromExport ? 'bg-gray-50 opacity-75' : 'bg-white'"
            >
              <td class="px-2 py-2 text-center align-middle">
                <input
                  v-model="row.excludeFromExport"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  :aria-label="`不轉檔 ${row.formNo}`"
                />
              </td>
              <td class="px-2 py-2 text-gray-600 tabular-nums">{{ row.serial }}</td>
              <td class="px-2 py-2 font-mono text-xs text-gray-800">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span>{{ row.formNo || '—' }}</span>
                  <span
                    v-if="row.previouslyExported"
                    class="shrink-0 text-[10px] font-medium tracking-wide px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900"
                  >
                    曾匯出
                  </span>
                </div>
              </td>
              <td class="px-2 py-2 text-gray-800 text-xs leading-snug">
                {{ row.receivingBank }}
              </td>
              <td class="px-2 py-2 font-mono text-xs text-gray-800">
                {{ row.accountDisplay }}
              </td>
              <td class="px-2 py-2 text-gray-800">{{ row.payeeName }}</td>
              <td class="px-2 py-2 font-mono text-xs text-gray-600">
                {{ row.taxId || '—' }}
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-gray-900">
                {{ row.amountDisplay }}
              </td>
              <td class="px-2 py-2 text-gray-800 whitespace-nowrap">
                {{ row.feeDisplay }}
              </td>
              <td class="px-2 py-2 text-right tabular-nums text-gray-600">0</td>
              <td class="px-2 py-2 text-xs text-gray-400">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <button
      type="button"
      @click="handleConvert"
      :disabled="convertDisabled"
      class="w-full mt-4 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
    >
      <span
        v-if="upload.isProcessing.value"
        class="flex items-center justify-center"
      >
        <svg
          class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        轉換中…
      </span>
      <span v-else>
        轉換檔案（{{ willExportCount }} 筆表單
        <template v-if="mergedExportLineCount > 0">
          · 預覽合併 {{ mergedExportLineCount }} 筆網銀
        </template>
        ）
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useFileUpload } from '~/composables/useFileUpload';
import { useToast } from '~/composables/useToast';
import { BankConvertCommeetConfig } from '~/constants/bankConvertCommeet';
import { ALLOWED_EXCEL_ONLY } from '~/constants/fileUpload';
import {
  groupRowsByPayeeName,
  sumAmount14Strings,
} from '~/utils/bankWireMerge';
import {
  extractCommeetWireExportRows,
  formatTwdAmountFromAmount14,
  readCommeetSheetMatrix,
} from '~/utils/commeetBankExcelParse';
import { downloadBlob, extractFilenameFromHeader } from '~/utils/fileUtils';
import { handlingFeeAllocationForPayee } from '~/utils/specialPayeeCompany';

const { success, error, warning } = useToast();

const API_EXPORTED_FORM_NOS = '/api/bank-wire-export-log/exported-form-nos';
const API_HISTORY = '/api/bank-wire-export-log?limit=150';

interface PreviewRowUi {
  formNo: string;
  serial: number;
  /** 14 位金額字串（分），供合併加總 */
  amount14: string;
  receivingBank: string;
  accountDisplay: string;
  payeeName: string;
  taxId: string;
  amountDisplay: string;
  feeDisplay: string;
  excludeFromExport: boolean;
  /** 曾寫入 BankWireExport_Log（預設不轉檔，仍可取消勾選） */
  previouslyExported: boolean;
}

interface MergedPreviewGroup {
  mergedLineIndex: number;
  payeeName: string;
  totalAmountDisplay: string;
  feeDisplay: string;
  formCount: number;
}

interface ExportLogRow {
  id: string;
  batchId: string;
  exportedAt: string;
  sourceFilename: string;
  mergedLineIndex: number;
  payeeName: string;
  payeeAccountDigits: string | null;
  bankCodeDigits: string | null;
  formNo: string;
  amountCents: string;
}

function formatCtsDisplay(amountCents: string): string {
  const cents = parseInt(amountCents, 10);
  if (!Number.isFinite(cents)) return amountCents;
  const yuan = Math.floor(cents / 100);
  const dec = cents % 100;
  return (
    yuan.toLocaleString('zh-TW', { maximumFractionDigits: 0 }) +
    '.' +
    String(dec).padStart(2, '0')
  );
}

function formatExportedAt(isoLike: string): string {
  if (!isoLike) return '—';
  const d = new Date(isoLike);
  if (Number.isNaN(d.getTime())) return isoLike.slice(0, 19).replace('T', ' ');
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

const parseError = ref('');
const isParsingPreview = ref(false);
const parseMeta = ref<{
  skippedNonWire: number;
  skippedInvalid: number;
} | null>(null);
const previewRows = ref<PreviewRowUi[]>([]);
const exportedFormNoSet = ref<Set<string>>(new Set());
const historyRows = ref<ExportLogRow[]>([]);
const historyLoading = ref(false);
const historyOpen = ref(true);

async function refreshExportedFormNos() {
  try {
    const r = await fetch(API_EXPORTED_FORM_NOS);
    if (!r.ok) return;
    const data = (await r.json()) as { formNos?: string[] };
    exportedFormNoSet.value = new Set(
      (data.formNos ?? []).map((x) => String(x).trim()).filter(Boolean)
    );
  } catch {
    /* 離線或 DB 未就緒時略過 */
  }
}

async function refreshHistory() {
  historyLoading.value = true;
  try {
    const r = await fetch(API_HISTORY);
    if (!r.ok) return;
    const data = (await r.json()) as { rows?: ExportLogRow[] };
    historyRows.value = data.rows ?? [];
  } catch {
    /* 略過 */
  } finally {
    historyLoading.value = false;
  }
}

function clearPreview() {
  parseError.value = '';
  parseMeta.value = null;
  previewRows.value = [];
}

async function runPreviewParse(file: File) {
  isParsingPreview.value = true;
  parseError.value = '';
  parseMeta.value = null;
  previewRows.value = [];
  try {
    const ab = await file.arrayBuffer();
    const sheet = readCommeetSheetMatrix(ab, BankConvertCommeetConfig);
    if (!sheet.ok) {
      parseError.value = sheet.error;
      return;
    }
    const extracted = extractCommeetWireExportRows(
      sheet.jsonData,
      BankConvertCommeetConfig
    );
    if (!extracted.ok) {
      parseError.value = extracted.error;
      return;
    }
    if (extracted.rows.length === 0) {
      parseError.value =
        '此檔案中沒有任何可轉檔的「匯款」列（或匯款列欄位／金額不完整）。';
      parseMeta.value = {
        skippedNonWire: extracted.skippedNonWire,
        skippedInvalid: extracted.skippedInvalid,
      };
      return;
    }
    parseMeta.value = {
      skippedNonWire: extracted.skippedNonWire,
      skippedInvalid: extracted.skippedInvalid,
    };
    await refreshExportedFormNos();
    const exported = exportedFormNoSet.value;
    previewRows.value = extracted.rows.map((r, i) => {
      const alloc = handlingFeeAllocationForPayee(r.payeeName);
      const inLog = r.formNo ? exported.has(String(r.formNo).trim()) : false;
      return {
        formNo: r.formNo,
        serial: i + 1,
        amount14: r.amount14,
        receivingBank: r.receivingBankDisplay,
        accountDisplay: r.accountDigits,
        payeeName: r.payeeName,
        taxId: r.payeeTaxId,
        amountDisplay: formatTwdAmountFromAmount14(r.amount14),
        feeDisplay: `${alloc.labelZh}（${alloc.code}）`,
        excludeFromExport: inLog,
        previouslyExported: inLog,
      };
    });
  } catch (e) {
    console.error(e);
    parseError.value = '無法讀取 Excel，請確認檔案未損毀且為 Commeet 付款資料格式。';
  } finally {
    isParsingPreview.value = false;
  }
}

const upload = useFileUpload({
  allowedExtensions: ALLOWED_EXCEL_ONLY,
  onValidate: async (file: File) => {
    const lower = file.name.toLowerCase();
    const ok = ALLOWED_EXCEL_ONLY.some((ext) => lower.endsWith(ext));
    if (!ok) {
      warning('請選擇 .xlsx 或 .xls 檔案');
      return false;
    }
    return true;
  },
});

watch(
  () => upload.selectedFile.value,
  (file) => {
    if (!file) {
      clearPreview();
      return;
    }
    runPreviewParse(file);
  }
);

onMounted(() => {
  refreshExportedFormNos();
  refreshHistory();
});

function onClearFile() {
  upload.clearFile();
  clearPreview();
}

const excludedCount = computed(
  () => previewRows.value.filter((r) => r.excludeFromExport).length
);

const previouslyExportedInFileCount = computed(
  () => previewRows.value.filter((r) => r.previouslyExported).length
);

const willExportCount = computed(
  () => previewRows.value.filter((r) => !r.excludeFromExport).length
);

const mergedPreviewGroups = computed((): MergedPreviewGroup[] => {
  const excluded = new Set(
    previewRows.value.filter((r) => r.excludeFromExport).map((r) => r.formNo)
  );
  const groups = groupRowsByPayeeName(previewRows.value, excluded);
  return groups.map((list, i) => {
    const first = list[0]!;
    const total14 = sumAmount14Strings(list.map((x) => x.amount14));
    const alloc = handlingFeeAllocationForPayee(first.payeeName);
    return {
      mergedLineIndex: i + 1,
      payeeName: first.payeeName,
      totalAmountDisplay: formatTwdAmountFromAmount14(total14),
      feeDisplay: `${alloc.labelZh}（${alloc.code}）`,
      formCount: list.length,
    };
  });
});

const mergedExportLineCount = computed(() => mergedPreviewGroups.value.length);

const convertDisabled = computed(() => {
  return (
    !upload.selectedFile.value ||
    upload.isProcessing.value ||
    isParsingPreview.value ||
    !!parseError.value ||
    previewRows.value.length === 0 ||
    willExportCount.value === 0
  );
});

const triggerFileInput = () => {
  if (typeof document !== 'undefined') {
    const input = document.getElementById(
      'bank-convert-file-input'
    ) as HTMLInputElement | null;
    input?.click();
  }
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return response.statusText || '請求失敗';
    try {
      const j = JSON.parse(text) as { statusMessage?: string; message?: string };
      return j.statusMessage || j.message || text;
    } catch {
      return text;
    }
  } catch {
    return '轉換失敗';
  }
}

const handleConvert = async () => {
  if (!upload.selectedFile.value || willExportCount.value === 0) return;

  upload.isProcessing.value = true;

  try {
    const excluded = previewRows.value
      .filter((r) => r.excludeFromExport)
      .map((r) => r.formNo);

    const formData = new FormData();
    formData.append('file', upload.selectedFile.value);
    formData.append('excludedFormNos', JSON.stringify(excluded));

    const response = await fetch('/api/bank-convert', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const msg = await readErrorMessage(response);
      throw new Error(msg);
    }

    const blob = await response.blob();

    if (blob.size === 0) {
      throw new Error('轉換後的檔案為空，請檢查輸入檔案格式是否正確');
    }

    const filename = extractFilenameFromHeader(
      response.headers.get('Content-Disposition'),
      'commeet整批付款.txt'
    );

    downloadBlob(blob, filename);

    success('轉換完成！檔案已下載');
    await refreshExportedFormNos();
    await refreshHistory();
    upload.clearFile();
    clearPreview();
  } catch (err: unknown) {
    console.error('轉換失敗:', err);
    const msg = err instanceof Error ? err.message : '轉換失敗，請稍後再試';
    error(msg);
  } finally {
    upload.isProcessing.value = false;
  }
};
</script>
