<template>
  <div class="simple-logo">
    <svg
      :width="size"
      :height="size * 0.6"
      viewBox="0 0 200 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- 簡化的建築圖標 -->
      <g transform="translate(20, 20)">
        <!-- 主建築 -->
        <rect
          x="10"
          y="30"
          width="50"
          height="50"
          :fill="primaryColor"
          rx="3"
        />

        <!-- 屋頂 -->
        <polygon points="5,30 35,10 65,30" :fill="secondaryColor" />

        <!-- 門 -->
        <rect
          x="30"
          y="55"
          width="10"
          height="25"
          fill="white"
          opacity="0.9"
          rx="2"
        />

        <!-- 十字架 -->
        <rect x="34" y="15" width="2" height="15" fill="white" />
        <rect x="27" y="20" width="16" height="2" fill="white" />
      </g>

      <!-- 文字 -->
      <text
        x="100"
        y="50"
        font-family="Arial, sans-serif"
        font-size="24"
        font-weight="bold"
        :fill="primaryColor"
      >
        SaintDong
      </text>

      <text
        x="100"
        y="75"
        font-family="Arial, sans-serif"
        font-size="12"
        font-weight="normal"
        fill="#6B7280"
      >
        Enterprise Platform
      </text>
    </svg>
  </div>
</template>

<script setup>
const props = defineProps({
  size: {
    type: Number,
    default: 200,
  },
  color: {
    type: String,
    default: 'blue',
  },
});

const primaryColor = props.color === 'blue' ? '#3B82F6' : '#8B5CF6';
const secondaryColor = props.color === 'blue' ? '#1D4ED8' : '#5B21B6';
</script>

<style scoped>
.simple-logo {
  @apply inline-block;
}
</style>
