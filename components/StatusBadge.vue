<template>
  <span :class="badgeClasses">
    {{ status }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
});

const badgeClasses = computed(() => {
  const baseClasses =
    'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';

  switch (props.status) {
    case '已核准':
      return `${baseClasses} bg-green-100 text-green-800`;
    case '待簽核':
      return `${baseClasses} bg-yellow-100 text-yellow-800`;
    case '已刪除':
      return `${baseClasses} bg-red-100 text-red-800`;
    default:
      return `${baseClasses} bg-gray-100 text-gray-800`;
  }
});
</script>
