<template>
  <div class="space-y-6">
    <FinanceBankWireExportLogPanel
      ref="historyPanelRef"
      accent="amber"
      :compact="true"
      title="匯款匯出紀錄"
    />

  <div class="bg-white rounded-lg shadow-sm border p-6">
    <div class="text-center mb-6">
      <div
        class="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4"
      >
        <svg
          class="w-8 h-8 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
      </div>
      <h2 class="text-xl font-semibold text-gray-900 mb-2">臨時整批匯款</h2>
      <p class="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
        上傳會計<strong> Payment 匯款清單</strong>（.xlsx），比對收款帳號清單後產出國泰 TXT。
        廠商預設不合併；員工代墊可改為依戶名合併。
      </p>
    </div>

    <FileUploadZone
      :selected-file="upload.selectedFile.value"
      :is-drag-over="upload.isDragOver.value"
      accept=".xlsx,.xls"
      accept-text="支援 .xlsx、.xls（Payment 匯款工作表）"
      color="amber"
      input-ref="bankAdhocFileInput"
      file-input-id="bank-adhoc-file-input"
      @dragover="upload.isDragOver.value = true"
      @dragleave="upload.isDragOver.value = false"
      @drop="upload.handleFileDrop"
      @click="triggerFileInput"
      @change="upload.handleFileSelect"
      @clear="onClearFile"
    />

    <div class="grid gap-4 sm:grid-cols-3 mb-4 mt-4">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">資料類型</label>
        <select
          v-model="profile"
          class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
          @change="onProfileChange"
        >
          <option value="employee">員工代墊（預設合併）</option>
          <option value="vendor">廠商／其他（預設不合併）</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">合併方式</label>
        <select
          v-model="mergeMode"
          class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
        >
          <option value="by_payee_name">依收款人戶名合併</option>
          <option value="none">不合併（一筆一列）</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">預定交易日期</label>
        <input
          v-model="scheduledDateInput"
          type="date"
          class="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
        />
      </div>
    </div>

    <details class="mt-2 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2">
      <summary class="text-sm font-medium text-slate-700 cursor-pointer select-none">
        進階：貼上 6 欄 CSV（選用）
      </summary>
      <div class="mt-3">
    <div class="mb-2 flex items-center justify-between gap-2">
      <label class="text-sm font-medium text-gray-800">貼上匯款列</label>
      <button
        type="button"
        class="text-xs text-amber-700 hover:text-amber-900"
        @click="loadExample"
      >
        填入範例
      </button>
    </div>
    <textarea
      v-model="pasteText"
      rows="8"
      class="w-full text-sm font-mono border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
      :placeholder="BankConvertAdhocConfig.PASTE_HINT"
    />
    <p class="mt-1 text-xs text-gray-500">{{ BankConvertAdhocConfig.PASTE_HINT }}</p>
      </div>
    </details>

    <div
      v-if="upload.selectedFile.value && excelParsing"
      class="mt-4 flex items-center gap-2 text-sm text-gray-600"
    >
      <svg class="animate-spin h-5 w-5 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      正在讀取 Excel…
    </div>

    <div class="mt-4 flex flex-wrap gap-3">
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
        :disabled="!canAnalyze || analysisLoading"
        @click="runAnalyze"
      >
        {{ analysisLoading ? '比對中…' : '解析並比對清單' }}
      </button>
      <button
        type="button"
        class="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
        @click="clearAll"
      >
        清除
      </button>
    </div>

    <div
      v-if="analysisError"
      class="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900"
      role="alert"
    >
      {{ analysisError }}
    </div>

    <div v-if="previewRows.length > 0" class="mt-6 space-y-4">
      <div class="flex flex-wrap gap-2 text-xs">
        <span class="rounded-full bg-slate-100 px-3 py-1">明細 {{ previewRows.length }} 筆</span>
        <span class="rounded-full bg-amber-100 px-3 py-1">合併後 {{ mergedGroups.length }} 筆</span>
        <span v-if="parseMeta?.skippedInvalid" class="rounded-full bg-rose-100 px-3 py-1">
          略過 {{ parseMeta.skippedInvalid }} 筆
        </span>
        <span v-if="excludedCount > 0" class="rounded-full bg-gray-100 px-3 py-1 text-gray-700">
          本次不轉檔 {{ excludedCount }} 筆
        </span>
        <span
          v-if="previouslyExportedInFileCount > 0"
          class="rounded-full bg-amber-100 px-3 py-1 text-amber-900 font-medium"
        >
          與紀錄重複 {{ previouslyExportedInFileCount }} 筆（預設不轉）
        </span>
      </div>

      <div class="overflow-x-auto rounded-lg border border-amber-100">
        <table class="min-w-[900px] w-full text-xs text-left">
          <thead class="bg-amber-50 text-amber-950 font-semibold border-b border-amber-100">
            <tr>
              <th class="px-2 py-2 text-center">不轉</th>
              <th class="px-2 py-2">#</th>
              <th class="px-2 py-2">戶名</th>
              <th class="px-2 py-2">事由</th>
              <th class="px-2 py-2">七碼</th>
              <th class="px-2 py-2">帳號</th>
              <th class="px-2 py-2 text-right">金額</th>
              <th class="px-2 py-2 min-w-[11rem]">紀錄重複</th>
              <th class="px-2 py-2 min-w-[14rem]">清單比對</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="row in previewRows"
              :key="'adhoc-' + row.serial"
              :class="row.excludeFromExport ? 'bg-gray-50 opacity-75' : ''"
            >
              <td class="px-2 py-2 text-center">
                <input
                  v-model="row.excludeFromExport"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-amber-600"
                />
              </td>
              <td class="px-2 py-2 tabular-nums">{{ row.serial }}</td>
              <td class="px-2 py-2">{{ row.payeeName }}</td>
              <td class="px-2 py-2 max-w-[10rem] truncate" :title="row.lineNote">
                {{ row.lineNote || '—' }}
              </td>
              <td class="px-2 py-2 font-mono">{{ row.receivingBank }}</td>
              <td class="px-2 py-2 font-mono">{{ row.accountDisplay }}</td>
              <td class="px-2 py-2 text-right tabular-nums">{{ row.amountDisplay }}</td>
              <td class="px-2 py-2 align-top">
                <template v-if="row.previouslyExported">
                  <span
                    class="inline-flex text-[10px] font-medium tracking-wide px-1.5 py-0.5 rounded-md"
                    :class="
                      row.duplicateTier === 'strong'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-700'
                    "
                  >
                    {{ row.duplicateTierLabel }}
                  </span>
                  <div class="mt-1 text-[10px] text-gray-500 leading-snug">
                    {{ duplicateLogSummary(row) }}
                  </div>
                </template>
                <span v-else class="text-gray-400">—</span>
              </td>
              <td class="px-2 py-2 align-top">
                <template v-if="analysisRowForSerial(row.serial) && resolutionDraft[row.serial - 1]">
                  <div class="space-y-1.5">
                    <div class="text-[11px] text-gray-600">
                      {{ lookupStatusLabel(analysisRowForSerial(row.serial)!.lookupStatus) }}
                    </div>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input
                        v-model="resolutionDraft[row.serial - 1]!.kind"
                        type="radio"
                        value="master"
                        class="h-3.5 w-3.5 text-amber-600"
                        :disabled="!canPickMaster(row.serial - 1)"
                      />
                      <span>使用清單帳號</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <input
                        v-model="resolutionDraft[row.serial - 1]!.kind"
                        type="radio"
                        value="excel"
                        class="h-3.5 w-3.5 text-amber-600"
                      />
                      <span>使用 Excel／貼上資料（可手填分行）</span>
                    </label>
                    <select
                      v-if="resolutionDraft[row.serial - 1]?.kind === 'master'"
                      v-model="resolutionDraft[row.serial - 1]!.payeeAccountId"
                      class="w-full max-w-[13rem] text-xs border border-gray-300 rounded px-1 py-1"
                    >
                      <option
                        v-for="c in masterChoicesForRow(row.serial - 1)"
                        :key="c.id"
                        :value="c.id"
                      >
                        {{ c.bank_code }}-{{ c.branch_code }} {{ c.account_no }}
                      </option>
                    </select>
                    <input
                      v-if="resolutionDraft[row.serial - 1]?.kind === 'excel'"
                      v-model="resolutionDraft[row.serial - 1]!.manualBranch4"
                      type="text"
                      maxlength="4"
                      placeholder="分行 4 碼"
                      class="w-20 text-xs border border-gray-300 rounded px-1 py-1 font-mono"
                    />
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!payeeResolutionOk" class="text-xs text-amber-800">
        尚有列未完成清單決議（選擇清單帳號或手填分行）。
      </div>
    </div>

    <button
      type="button"
      class="mt-6 w-full py-3 rounded-lg text-sm font-semibold transition-colors"
      :class="
        convertDisabled
          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
          : 'bg-amber-600 text-white hover:bg-amber-700'
      "
      :disabled="convertDisabled"
      @click="runConvert"
    >
      {{ converting ? '轉檔中…' : `產出 TXT（${activeWireCount} 筆 → ${mergedGroups.length} 列）` }}
    </button>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { BankConvertAdhocConfig } from '~/constants/bankConvertAdhoc';
import { ALLOWED_EXCEL_ONLY } from '~/constants/fileUpload';
import { formatTwdAmountFromAmount14 } from '~/utils/commeetBankExcelParse';
import {
  parseAdhocPasteText,
  adhocInputRowsToWireExtract,
  type AdhocWireExtractResult,
} from '~/utils/adhocBankWireParse';
import {
  extractAdhocPaymentExcelWireRows,
  readAdhocPaymentSheetMatrix,
} from '~/utils/adhocPaymentExcelParse';
import { groupWireRowsForExport, type WireMergeMode } from '~/utils/bankWireMerge';
import { downloadBlob, extractFilenameFromHeader } from '~/utils/fileUtils';
import { useFileUpload } from '~/composables/useFileUpload';
import { useToast } from '~/composables/useToast';

const API_ANALYZE = '/api/bank-adhoc/analyze';
const API_CONVERT = '/api/bank-adhoc';

interface PayeeFuseRecordDto {
  id: string;
  name: string;
  bank_code: string;
  branch_code: string;
  account_no: string;
}

interface BankWireAnalyzeRowDto {
  rowIndex: number;
  formNo: string;
  validationError: string | null;
  lookupStatus: string;
  accountMatchCount?: number;
  excel: {
    payeeName: string;
    bankDigits: string;
    accountDigits: string;
    branchDigits4: string;
    receivingBankDisplay: string;
    payeeBankCode7: string;
  };
  suggestedMaster: PayeeFuseRecordDto | null;
  candidates: PayeeFuseRecordDto[];
  excelVsMasterMismatch: boolean;
}

interface BankWireDuplicateMatchDto {
  rowIndex: number;
  tier: 'strong' | 'weak';
  tierLabel: string;
  log: {
    id: string;
    batchId: string;
    batchType: string | null;
    scheduledTxDate: string | null;
    exportedAt: string;
    payeeName: string;
    payeeAccountDigits: string;
    amountCents: number;
  };
}

interface WireResolutionUi {
  rowIndex: number;
  kind: 'master' | 'excel';
  payeeAccountId: string;
  manualBranch4: string;
}

interface PreviewRowUi {
  serial: number;
  payeeName: string;
  lineNote: string;
  amount14: string;
  receivingBank: string;
  accountDisplay: string;
  amountDisplay: string;
  excludeFromExport: boolean;
  previouslyExported: boolean;
  duplicateTier: 'strong' | 'weak' | null;
  duplicateTierLabel: string;
  duplicateLogBatchType: string | null;
  duplicateLogScheduledTxDate: string | null;
  duplicateLogExportedAt: string | null;
}

const { success, error: toastError } = useToast();

const historyPanelRef = ref<{ refresh: () => Promise<void> } | null>(null);

const pasteText = ref('');
const sourceLabel = ref('');
const wireExtract = ref<AdhocWireExtractResult | null>(null);
const excelParsing = ref(false);
const profile = ref<'employee' | 'vendor'>('vendor');
const mergeMode = ref<WireMergeMode>(
  BankConvertAdhocConfig.DEFAULT_MERGE_BY_PROFILE.vendor
);
const scheduledDateInput = ref(todayInputValue());
const analysisLoading = ref(false);
const analysisError = ref('');
const analysisRows = ref<BankWireAnalyzeRowDto[]>([]);
const resolutionDraft = ref<Record<number, WireResolutionUi>>({});
const previewRows = ref<PreviewRowUi[]>([]);
const parseMeta = ref<{ skippedInvalid: number } | null>(null);
const wireRowCount = ref(0);
const converting = ref(false);

const upload = useFileUpload({
  allowedExtensions: ALLOWED_EXCEL_ONLY,
  onValidate: async (file: File) => {
    const lower = file.name.toLowerCase();
    const ok = ALLOWED_EXCEL_ONLY.some((ext) => lower.endsWith(ext));
    if (!ok) {
      toastError('請選擇 .xlsx 或 .xls 檔案');
      return false;
    }
    return true;
  },
});

const canAnalyze = computed(
  () => !!wireExtract.value?.rows.length || !!pasteText.value.trim()
);

function triggerFileInput() {
  const el = document.getElementById('bank-adhoc-file-input') as HTMLInputElement | null;
  el?.click();
}

function todayInputValue(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts;
}

function scheduledTxDateYmd(): string {
  return scheduledDateInput.value.replace(/-/g, '');
}

function onProfileChange() {
  mergeMode.value =
    profile.value === 'employee'
      ? BankConvertAdhocConfig.DEFAULT_MERGE_BY_PROFILE.employee
      : BankConvertAdhocConfig.DEFAULT_MERGE_BY_PROFILE.vendor;
}

function duplicateLogBatchTypeLabel(batchType: string | null): string {
  switch (batchType) {
    case 'commeet':
      return 'Commeet';
    case 'adhoc':
      return '臨時整批';
    case 'manual_backfill':
      return '手動補登';
    default:
      return batchType?.trim() || '匯出紀錄';
  }
}

function formatYmdDisplay(ymd: string | null): string {
  const s = String(ymd ?? '').trim();
  if (!/^\d{8}$/.test(s)) return '';
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function duplicateLogSummary(row: PreviewRowUi): string {
  const parts: string[] = [];
  const typeLabel = duplicateLogBatchTypeLabel(row.duplicateLogBatchType);
  if (typeLabel) parts.push(typeLabel);
  const tx = formatYmdDisplay(row.duplicateLogScheduledTxDate);
  if (tx) parts.push(`交易日 ${tx}`);
  if (row.duplicateLogExportedAt) {
    const d = row.duplicateLogExportedAt.slice(0, 10);
    if (d) parts.push(`匯出 ${d}`);
  }
  return parts.join(' · ') || '—';
}

function loadExample() {
  pasteText.value = BankConvertAdhocConfig.PASTE_EXAMPLE_EMPLOYEE;
}

function clearPreview() {
  analysisError.value = '';
  analysisRows.value = [];
  resolutionDraft.value = {};
  previewRows.value = [];
  parseMeta.value = null;
  wireRowCount.value = 0;
  wireExtract.value = null;
}

function clearAll() {
  pasteText.value = '';
  sourceLabel.value = '';
  upload.clearFile();
  clearPreview();
}

function onClearFile() {
  upload.clearFile();
  sourceLabel.value = '';
  wireExtract.value = null;
  clearPreview();
}

async function parseExcelFile(file: File) {
  excelParsing.value = true;
  clearPreview();
  sourceLabel.value = file.name;
  mergeMode.value = BankConvertAdhocConfig.DEFAULT_MERGE_BY_PROFILE.vendor;
  profile.value = 'vendor';
  try {
    const ab = await file.arrayBuffer();
    const sheet = readAdhocPaymentSheetMatrix(ab);
    if (!sheet.ok) {
      analysisError.value = sheet.error;
      return;
    }
    const extracted = extractAdhocPaymentExcelWireRows(sheet.jsonData);
    if (!extracted.ok) {
      analysisError.value = extracted.error;
      return;
    }
    wireExtract.value = extracted.data;
    await runAnalyze();
  } catch {
    analysisError.value = '無法讀取 Excel，請確認為會計 Payment 匯款清單格式。';
  } finally {
    excelParsing.value = false;
  }
}

watch(
  () => upload.selectedFile.value,
  (file) => {
    if (!file) return;
    void parseExcelFile(file);
  }
);

function lookupStatusLabel(status: string): string {
  switch (status) {
    case 'branch_invalid':
      return '分行與清單不一致';
    case 'excel_only':
      return '清單無此帳號';
    case 'name_hint_only':
      return '清單無此帳號—相似戶名僅供參考';
    case 'suggest_master':
      return '清單帳號一致';
    case 'confirm_master':
      return '七碼不同—請確認';
    case 'choose_master':
      return '請選擇清單列';
    default:
      return status;
  }
}

function analysisRowForSerial(serial: number): BankWireAnalyzeRowDto | undefined {
  return analysisRows.value.find((r) => r.rowIndex === serial - 1);
}

function masterChoicesForRow(rowIndex: number): PayeeFuseRecordDto[] {
  const ar = analysisRows.value.find((r) => r.rowIndex === rowIndex);
  if (!ar) return [];
  const list: PayeeFuseRecordDto[] = [];
  const seen = new Set<string>();
  for (const c of [ar.suggestedMaster, ...(ar.candidates ?? [])]) {
    if (!c) continue;
    const id = String(c.id);
    if (seen.has(id)) continue;
    seen.add(id);
    list.push(c);
  }
  return list;
}

function canPickMaster(rowIndex: number): boolean {
  return masterChoicesForRow(rowIndex).length > 0;
}

function initResolutionDraftFromAnalysis(rows: BankWireAnalyzeRowDto[]) {
  const d: Record<number, WireResolutionUi> = {};
  for (const ar of rows) {
    if (ar.lookupStatus === 'excel_only' || ar.lookupStatus === 'name_hint_only') {
      d[ar.rowIndex] = {
        rowIndex: ar.rowIndex,
        kind: 'excel',
        payeeAccountId: '',
        manualBranch4: '',
      };
      continue;
    }
    const choices = masterChoicesForRow(ar.rowIndex);
    d[ar.rowIndex] = {
      rowIndex: ar.rowIndex,
      kind: choices.length > 0 ? 'master' : 'excel',
      payeeAccountId: String(ar.suggestedMaster?.id ?? choices[0]?.id ?? ''),
      manualBranch4: '',
    };
  }
  resolutionDraft.value = d;
}

const payeeResolutionOk = computed(() => {
  if (previewRows.value.length === 0) return false;
  for (let i = 0; i < previewRows.value.length; i++) {
    const row = previewRows.value[i]!;
    if (row.excludeFromExport) continue;
    const draft = resolutionDraft.value[i];
    const ar = analysisRows.value.find((r) => r.rowIndex === i);
    if (!draft || !ar) return false;
    if (draft.kind === 'master') {
      if (!draft.payeeAccountId) return false;
      continue;
    }
    if (ar.validationError && !draft.manualBranch4.trim()) return false;
  }
  return true;
});

const excludedRowIndexes = computed(() => {
  const set = new Set<number>();
  previewRows.value.forEach((r, i) => {
    if (r.excludeFromExport) set.add(i);
  });
  return set;
});

const activeWireCount = computed(
  () => previewRows.value.filter((r) => !r.excludeFromExport).length
);

const excludedCount = computed(
  () => previewRows.value.filter((r) => r.excludeFromExport).length
);

const previouslyExportedInFileCount = computed(
  () => previewRows.value.filter((r) => r.previouslyExported).length
);

const mergedGroups = computed(() => {
  if (wireRowCount.value === 0 || previewRows.value.length === 0) return [];
  const rows = previewRows.value.map((p) => ({
      formNo: '',
      payeeName: p.payeeName,
      payeeBankCode7: p.receivingBank,
      amount14: p.amount14,
      accountDigits: p.accountDisplay,
      payeeBank3: p.receivingBank.slice(0, 3),
      bankDigits: p.receivingBank.slice(0, 3),
      branchDigits4: p.receivingBank.slice(3, 7),
      payeeTaxId: '',
      bankNameLabel: '',
      receivingBankDisplay: p.receivingBank,
      branchCellRaw: undefined,
  }));
  return groupWireRowsForExport(rows, {
    excludedRowIndexes: excludedRowIndexes.value,
    mergeMode: mergeMode.value,
  });
});

const convertDisabled = computed(
  () =>
    converting.value ||
    analysisLoading.value ||
    previewRows.value.length === 0 ||
    activeWireCount.value === 0 ||
    !payeeResolutionOk.value ||
    !scheduledTxDateYmd().match(/^\d{8}$/)
);

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { statusMessage?: string; message?: string };
    return data.statusMessage || data.message || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function runAnalyze() {
  analysisLoading.value = true;
  analysisError.value = '';
  analysisRows.value = [];
  resolutionDraft.value = {};
  previewRows.value = [];
  parseMeta.value = null;

  try {
    let extractData: AdhocWireExtractResult;

    if (wireExtract.value?.rows.length) {
      extractData = wireExtract.value;
    } else {
      const localExtract = adhocInputRowsToWireExtract(
        parseAdhocPasteText(pasteText.value)
      );
      if (!localExtract.ok) throw new Error(localExtract.error);
      extractData = localExtract.data;
      if (!sourceLabel.value) {
        sourceLabel.value = `臨時整批匯款_paste_${scheduledTxDateYmd()}.txt`;
      }
    }

    wireRowCount.value = extractData.rows.length;

    const r = await fetch(API_ANALYZE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wireExtract: extractData,
        mergeMode: mergeMode.value,
        scheduledTxDateYmd: scheduledTxDateYmd(),
        sourceLabel: sourceLabel.value || `臨時整批匯款_${scheduledTxDateYmd()}.txt`,
      }),
    });
    if (!r.ok) throw new Error(await readErrorMessage(r));

    const data = (await r.json()) as {
      rows?: BankWireAnalyzeRowDto[];
      skippedInvalid?: number;
      duplicateMatches?: BankWireDuplicateMatchDto[];
    };
    const rows = data.rows ?? [];
    analysisRows.value = rows;
    parseMeta.value = { skippedInvalid: data.skippedInvalid ?? extractData.skippedInvalid };

    const dupByRow = new Map(
      (data.duplicateMatches ?? []).map((m) => [m.rowIndex, m] as const)
    );

    previewRows.value = extractData.rows.map((wr, i) => {
      const dup = dupByRow.get(i);
      const inLog = !!dup;
      return {
        serial: i + 1,
        payeeName: wr.payeeName,
        lineNote: extractData.lineNotes[i] ?? '',
        amount14: wr.amount14,
        receivingBank: wr.payeeBankCode7,
        accountDisplay: wr.accountDigits,
        amountDisplay: formatTwdAmountFromAmount14(wr.amount14),
        excludeFromExport: inLog,
        previouslyExported: inLog,
        duplicateTier: dup?.tier ?? null,
        duplicateTierLabel: dup?.tierLabel ?? '',
        duplicateLogBatchType: dup?.log.batchType ?? null,
        duplicateLogScheduledTxDate: dup?.log.scheduledTxDate ?? null,
        duplicateLogExportedAt: dup?.log.exportedAt ?? null,
      };
    });

    if (rows.length > 0) initResolutionDraftFromAnalysis(rows);
  } catch (e: unknown) {
    analysisError.value = e instanceof Error ? e.message : '分析失敗';
  } finally {
    analysisLoading.value = false;
  }
}

function buildResolutionsPayload() {
  return previewRows.value.map((_, i) => {
    const d = resolutionDraft.value[i]!;
    return {
      rowIndex: i,
      kind: d.kind,
      payeeAccountId: d.kind === 'master' ? d.payeeAccountId : undefined,
      manualBranch4: d.kind === 'excel' ? d.manualBranch4 : undefined,
    };
  });
}

async function runConvert() {
  if (convertDisabled.value) return;
  converting.value = true;
  try {
    const response = await fetch(API_CONVERT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wireExtract: wireExtract.value ?? undefined,
        pasteText: wireExtract.value ? undefined : pasteText.value,
        mergeMode: mergeMode.value,
        scheduledTxDateYmd: scheduledTxDateYmd(),
        sourceLabel: sourceLabel.value || `臨時整批匯款_${scheduledTxDateYmd()}.txt`,
        excludedRowIndexes: [...excludedRowIndexes.value],
        resolutions: buildResolutionsPayload(),
      }),
    });
    if (!response.ok) throw new Error(await readErrorMessage(response));

    const blob = await response.blob();
    const defaultFilename = `臨時整批匯款_${scheduledTxDateYmd()}.txt`;
    const filename = extractFilenameFromHeader(
      response.headers.get('Content-Disposition'),
      defaultFilename
    );
    downloadBlob(blob, filename);
    success('臨時整批匯款 TXT 已下載');
    await historyPanelRef.value?.refresh();
  } catch (e: unknown) {
    toastError(e instanceof Error ? e.message : '轉檔失敗');
  } finally {
    converting.value = false;
  }
}
</script>
