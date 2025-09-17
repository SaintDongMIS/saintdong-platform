<template>
  <div class="saintdong-logo" :class="{ 'animate-pulse': animated }">
    <svg
      :width="size"
      :height="size * 0.4"
      viewBox="0 0 300 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      class="transition-all duration-300"
    >
      <!-- 背景圓形裝飾 -->
      <circle
        cx="60"
        cy="60"
        r="45"
        :fill="`url(#gradient-${variant})`"
        opacity="0.1"
        class="transition-all duration-500"
      />

      <!-- 主圖標 - 聖殿/建築風格 -->
      <g transform="translate(25, 25)">
        <!-- 建築主體 -->
        <rect
          x="10"
          y="20"
          width="40"
          height="50"
          :fill="primaryColor"
          rx="2"
          class="transition-all duration-300"
        />

        <!-- 屋頂 -->
        <polygon
          points="5,20 35,5 65,20"
          :fill="secondaryColor"
          class="transition-all duration-300"
        />

        <!-- 門 -->
        <rect
          x="25"
          y="45"
          width="10"
          height="25"
          fill="white"
          opacity="0.8"
          rx="1"
        />

        <!-- 窗戶 -->
        <rect
          x="15"
          y="30"
          width="8"
          height="8"
          fill="white"
          opacity="0.6"
          rx="1"
        />
        <rect
          x="37"
          y="30"
          width="8"
          height="8"
          fill="white"
          opacity="0.6"
          rx="1"
        />

        <!-- 十字架 -->
        <rect x="29" y="10" width="2" height="12" fill="white" />
        <rect x="25" y="14" width="10" height="2" fill="white" />
      </g>

      <!-- 文字部分 -->
      <g transform="translate(90, 0)">
        <!-- SaintDong 文字 -->
        <text
          x="0"
          y="35"
          font-family="Arial, sans-serif"
          font-size="28"
          font-weight="bold"
          :fill="primaryColor"
          class="transition-all duration-300"
        >
          SaintDong
        </text>

        <!-- 副標題 -->
        <text
          x="0"
          y="55"
          font-family="Arial, sans-serif"
          font-size="14"
          font-weight="normal"
          :fill="textColor"
          opacity="0.8"
        >
          Enterprise Platform
        </text>

        <!-- 裝飾線條 -->
        <rect
          x="0"
          y="65"
          width="180"
          height="2"
          :fill="accentColor"
          rx="1"
          class="transition-all duration-500"
        />

        <!-- 點綴元素 -->
        <circle
          cx="185"
          cy="66"
          r="3"
          :fill="accentColor"
          class="transition-all duration-300"
        />
      </g>

      <!-- 漸變定義 -->
      <defs>
        <linearGradient id="gradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color: #3b82f6; stop-opacity: 1" />
          <stop offset="100%" style="stop-color: #1d4ed8; stop-opacity: 1" />
        </linearGradient>

        <linearGradient
          id="gradient-purple"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" style="stop-color: #8b5cf6; stop-opacity: 1" />
          <stop offset="100%" style="stop-color: #5b21b6; stop-opacity: 1" />
        </linearGradient>

        <linearGradient id="gradient-green" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color: #10b981; stop-opacity: 1" />
          <stop offset="100%" style="stop-color: #047857; stop-opacity: 1" />
        </linearGradient>

        <linearGradient
          id="gradient-orange"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" style="stop-color: #f59e0b; stop-opacity: 1" />
          <stop offset="100%" style="stop-color: #d97706; stop-opacity: 1" />
        </linearGradient>
      </defs>
    </svg>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  size: {
    type: Number,
    default: 300,
  },
  variant: {
    type: String,
    default: 'blue', // blue, purple, green, orange
    validator: (value) => ['blue', 'purple', 'green', 'orange'].includes(value),
  },
  animated: {
    type: Boolean,
    default: false,
  },
});

const primaryColor = computed(() => {
  const colors = {
    blue: '#3B82F6',
    purple: '#8B5CF6',
    green: '#10B981',
    orange: '#F59E0B',
  };
  return colors[props.variant];
});

const secondaryColor = computed(() => {
  const colors = {
    blue: '#1D4ED8',
    purple: '#5B21B6',
    green: '#047857',
    orange: '#D97706',
  };
  return colors[props.variant];
});

const accentColor = computed(() => {
  const colors = {
    blue: '#60A5FA',
    purple: '#A78BFA',
    green: '#34D399',
    orange: '#FBBF24',
  };
  return colors[props.variant];
});

const textColor = computed(() => {
  return props.variant === 'blue' ? '#374151' : '#6B7280';
});
</script>

<style scoped>
.saintdong-logo {
  @apply inline-block;
}

.saintdong-logo:hover svg {
  @apply transform scale-105;
}

.saintdong-logo svg {
  @apply transition-all duration-300 ease-in-out;
}
</style>
