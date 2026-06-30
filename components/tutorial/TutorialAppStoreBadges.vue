<script setup lang="ts">
const APP_STORE_URL =
  'https://apps.apple.com/tw/app/commeet-%E9%9B%B2%E7%AB%AF%E8%B2%BB%E7%94%A8%E7%AE%A1%E7%90%86%E7%B3%BB%E7%B5%B1/id1577508132';

const GOOGLE_PLAY_URL =
  'https://play.google.com/store/apps/details?id=co.commeet.app&hl=zh_TW';
</script>

<template>
  <div class="rounded-xl border border-orange-100 bg-orange-50/40 px-5 py-4">
    <p class="text-sm font-medium text-slate-700">
      下載 COMMEET 手機 App
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-3">
      <a
        :href="GOOGLE_PLAY_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
      >
        <img
          src="https://play.google.com/intl/zh-TW/badges/static/images/badges/zh-tw_badge_web_generic.png"
          alt="在 Google Play 上取得"
          class="h-10 w-auto sm:h-11"
          width="155"
          height="60"
          loading="lazy"
        />
      </a>
      <a
        :href="APP_STORE_URL"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-block rounded-md transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
      >
        <img
          src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/zh-tw?size=250x83"
          alt="在 App Store 下載"
          class="h-10 w-auto sm:h-11"
          width="120"
          height="40"
          loading="lazy"
        />
      </a>
    </div>
  </div>
</template>
