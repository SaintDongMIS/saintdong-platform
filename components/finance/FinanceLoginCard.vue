<script setup lang="ts">
const { login } = useFinanceAuth();

const formUsername = ref('');
const formPassword = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');

async function onSubmit() {
  errorMessage.value = '';
  loading.value = true;
  try {
    await login(formUsername.value, formPassword.value);
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string }; statusMessage?: string };
    errorMessage.value =
      err.data?.statusMessage || err.statusMessage || '登入失敗，請稍後再試';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <div class="flex flex-col items-center mb-8">
          <SaintDongLogo :size="72" variant="blue" />
          <h1 class="mt-4 text-xl font-semibold text-gray-900">財務部門登入</h1>
          <p class="mt-1 text-sm text-gray-500 text-center">
            僅限授權人員使用
          </p>
        </div>

        <form class="space-y-4" @submit.prevent="onSubmit">
          <div>
            <label for="finance-username" class="block text-sm font-medium text-gray-700 mb-1">
              帳號
            </label>
            <input
              id="finance-username"
              v-model="formUsername"
              type="text"
              name="username"
              autocomplete="username"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="請輸入帳號"
            />
          </div>

          <div>
            <label for="finance-password" class="block text-sm font-medium text-gray-700 mb-1">
              密碼
            </label>
            <div class="relative">
              <input
                id="finance-password"
                v-model="formPassword"
                :type="showPassword ? 'text' : 'password'"
                name="password"
                autocomplete="current-password"
                required
                class="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-10 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                class="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                :aria-label="showPassword ? '隱藏密碼' : '顯示密碼'"
                @click="showPassword = !showPassword"
              >
                <svg
                  v-if="showPassword"
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                  />
                </svg>
                <svg
                  v-else
                  class="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
              </button>
            </div>
          </div>

          <p
            v-if="errorMessage"
            class="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {{ errorMessage }}
          </p>

          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ loading ? '登入中…' : '登入' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
