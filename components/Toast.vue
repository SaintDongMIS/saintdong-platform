<template>
  <Teleport to="body">
    <TransitionGroup
      name="toast"
      tag="div"
      class="fixed top-6 right-6 z-[9999] flex flex-col gap-4 pointer-events-none"
      style="max-width: 450px; width: auto"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto transform transition-all duration-300 ease-in-out rounded-xl shadow-2xl border-2 overflow-hidden"
        :class="getToastClass(toast.type)"
      >
        <div class="flex items-start p-6 gap-4">
          <!-- 大型圖標 -->
          <div
            class="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
            :class="getIconBgClass(toast.type)"
          >
            <!-- 成功圖標 -->
            <svg
              v-if="toast.type === 'success'"
              class="w-6 h-6"
              :class="getIconColorClass(toast.type)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <!-- 錯誤圖標 -->
            <svg
              v-else-if="toast.type === 'error'"
              class="w-6 h-6"
              :class="getIconColorClass(toast.type)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <!-- 警告圖標 -->
            <svg
              v-else-if="toast.type === 'warning'"
              class="w-6 h-6"
              :class="getIconColorClass(toast.type)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <!-- 資訊圖標 -->
            <svg
              v-else
              class="w-6 h-6"
              :class="getIconColorClass(toast.type)"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2.5"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <!-- 訊息內容 -->
          <div class="flex-1 min-w-0">
            <p
              class="text-lg font-semibold leading-relaxed"
              :class="getTextClass(toast.type)"
            >
              {{ toast.message }}
            </p>
          </div>

          <!-- 關閉按鈕 -->
          <button
            @click="removeToast(toast.id)"
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-black/10 focus:outline-none"
            :class="getCloseButtonClass(toast.type)"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup>
import { useToast } from '~/composables/useToast';

const { toasts, removeToast } = useToast();

const getToastClass = (type) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-300';
    case 'error':
      return 'bg-red-50 border-red-300';
    case 'warning':
      return 'bg-yellow-50 border-yellow-300';
    case 'info':
      return 'bg-blue-50 border-blue-300';
    default:
      return 'bg-gray-50 border-gray-300';
  }
};

const getIconBgClass = (type) => {
  switch (type) {
    case 'success':
      return 'bg-green-100';
    case 'error':
      return 'bg-red-100';
    case 'warning':
      return 'bg-yellow-100';
    case 'info':
      return 'bg-blue-100';
    default:
      return 'bg-gray-100';
  }
};

const getIconColorClass = (type) => {
  switch (type) {
    case 'success':
      return 'text-green-600';
    case 'error':
      return 'text-red-600';
    case 'warning':
      return 'text-yellow-600';
    case 'info':
      return 'text-blue-600';
    default:
      return 'text-gray-600';
  }
};

const getTextClass = (type) => {
  switch (type) {
    case 'success':
      return 'text-green-900';
    case 'error':
      return 'text-red-900';
    case 'warning':
      return 'text-yellow-900';
    case 'info':
      return 'text-blue-900';
    default:
      return 'text-gray-900';
  }
};

const getCloseButtonClass = (type) => {
  switch (type) {
    case 'success':
      return 'text-green-700 hover:bg-green-100';
    case 'error':
      return 'text-red-700 hover:bg-red-100';
    case 'warning':
      return 'text-yellow-700 hover:bg-yellow-100';
    case 'info':
      return 'text-blue-700 hover:bg-blue-100';
    default:
      return 'text-gray-700 hover:bg-gray-100';
  }
};
</script>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(120%) scale(0.8);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(120%) scale(0.8);
}

.toast-move {
  transition: transform 0.4s ease;
}
</style>
