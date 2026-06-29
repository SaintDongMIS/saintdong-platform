<script setup lang="ts">
import { formatVideoTime } from '~/utils/formatVideoTime';

const props = defineProps<{
  videoStartSeconds?: number;
  videoChapterId?: string;
}>();

const { seek } = useTutorialVideoSeek();

const sampleInput = ref('ER20250629001');
const isAnimating = ref(false);

const formTypes: Record<string, { name: string; color: string }> = {
  ER: { name: '費用報銷單', color: 'text-blue-600 bg-blue-50' },
  EA: { name: '費用申請單', color: 'text-emerald-600 bg-emerald-50' },
  PE: { name: '預先付款單', color: 'text-amber-600 bg-amber-50' },
};

const parsed = computed(() => {
  const raw = sampleInput.value.trim().toUpperCase();
  const match = raw.match(/^(EA|ER|PE)(\d{8})(\d+)?$/);

  if (!match) {
    return {
      valid: false,
      prefix: raw.slice(0, 2),
      message: '請輸入格式如 ER20250629001（代碼 + 8 位日期 + 序號）',
    };
  }

  const [, prefix, dateStr, serial] = match;
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const form = formTypes[prefix];

  return {
    valid: true,
    prefix,
    formName: form?.name ?? '未知表單',
    formColor: form?.color ?? 'text-slate-600 bg-slate-50',
    date: `${year}/${month}/${day}`,
    serial: serial ?? '—',
    message: '',
  };
});

function animateDecode() {
  isAnimating.value = true;
  setTimeout(() => {
    isAnimating.value = false;
  }, 600);
}

watch(sampleInput, animateDecode);
</script>

<template>
  <section class="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-slate-900">快速辨識表單編號</h2>
        <p class="mt-2 text-slate-600">
          從表單編號開頭（EA、ER、PE）與後續數字，快速判讀單據種類與填單日期。
        </p>
      </div>
      <button
        v-if="videoStartSeconds != null"
        type="button"
        class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100"
        @click="seek(videoStartSeconds!, videoChapterId)"
      >
        ▶ 觀看影片說明 {{ formatVideoTime(videoStartSeconds) }}
      </button>
    </div>

    <div class="mt-6">
      <label for="doc-number-input" class="block text-sm font-medium text-slate-700">
        試試看：輸入表單編號
      </label>
      <input
        id="doc-number-input"
        v-model="sampleInput"
        type="text"
        class="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 font-mono text-lg tracking-wide focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
        placeholder="ER20250629001"
      />
    </div>

    <div
      class="mt-6 transition-all duration-500"
      :class="isAnimating ? 'scale-[0.98] opacity-70' : 'scale-100 opacity-100'"
    >
      <div
        v-if="parsed.valid"
        class="grid gap-3 sm:grid-cols-3"
      >
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            表單種類
          </p>
          <p class="mt-2 flex items-center gap-2">
            <span
              class="rounded-md px-2 py-1 font-mono text-sm font-bold"
              :class="parsed.formColor"
            >
              {{ parsed.prefix }}
            </span>
            <span class="font-medium text-slate-900">{{ parsed.formName }}</span>
          </p>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            填單日期
          </p>
          <p class="mt-2 text-lg font-semibold text-slate-900">
            {{ parsed.date }}
          </p>
        </div>
        <div class="rounded-xl border border-slate-100 bg-slate-50 p-4">
          <p class="text-xs font-medium uppercase tracking-wide text-slate-500">
            流水序號
          </p>
          <p class="mt-2 font-mono text-lg font-semibold text-slate-900">
            {{ parsed.serial }}
          </p>
        </div>
      </div>
      <p v-else class="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
        {{ parsed.message }}
      </p>
    </div>

    <div class="mt-6 flex flex-wrap gap-2">
      <button
        v-for="(info, code) in formTypes"
        :key="code"
        type="button"
        class="rounded-full px-3 py-1.5 text-sm font-medium transition-colors hover:opacity-80"
        :class="info.color"
        @click="sampleInput = `${code}20250629001`"
      >
        {{ code }} 範例
      </button>
    </div>
  </section>
</template>
