<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  type?: 'cp' | 'country' | 'pretty_id' | 'recharge_tycoon' | 'supreme_recharge'
  lUserName?: string
  lAvatar?: string
  lFrameName?: string
  lOverFlow?: number
  ltop?: number
  rUserName?: string
  rAvatar?: string
  rFrameName?: string
  rOverFlow?: number
  rtop?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'cp',
  lUserName: 'Male User',
  lAvatar: '',
  lFrameName: 'frames/events/cp',
  lOverFlow: 150,
  ltop: 50,
  rUserName: 'Female User',
  rAvatar: '',
  rFrameName: 'frames/5',
  rOverFlow: 150,
  rtop: 50,
});

// Config mapping for different types
const typeConfig = {
  cp: {
    banner: '/siteAssets/banners/cp.webp',
    header: '/siteAssets/banners/cp-header.webp',
    decor: '/siteAssets/banners/decor-main-content.webp',
    shadowClass: 'shadow-primary/30',
    textShadow: 'text-shadow-primary',
  },
  country: {
    banner: '/siteAssets/banners/country.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-success/30',
    textShadow: 'text-shadow-success',
  },
  pretty_id: {
    banner: '/siteAssets/banners/pretty-id.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-secondary/30',
    textShadow: 'text-shadow-secondary',
  },
  recharge_tycoon: {
    banner: '/siteAssets/banners/recharge-tycoon.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-tertiary/30',
    textShadow: 'text-shadow-tertiary',
  },
  supreme_recharge: {
    banner: '/siteAssets/banners/supreme_recharge.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-secondary/30',
    textShadow: 'text-shadow-secondary',
  },
}

const config = computed(() => typeConfig[props.type])
</script>

<template>
  <div class="relative border border-white/50 rounded-lg shadow-lg" :class="config.shadowClass">
    <NuxtImg
        provider="imagekit"
        :src="config.banner"
        class="absolute h-full w-full rounded-lg"
    />
    <div class="relative w-full h-full">
      <!-- Header Area -->
      <div class="just-flex-items-center">
        <NuxtImg
            provider="imagekit"
            :src="config.header"
            class="h-8 -mt-4"
        />
        <h2
            class="absolute inset-0 text-lg font-bold text-center text-shadow-lg -mt-4"
            :class="config.textShadow"
        >
          <slot />
        </h2>
      </div>

      <!-- Main Content -->
      <div class="just-flex-items-center gap-2 p-2">
        <Avatar
            :animated="true"
            :frame_overflow="props.lOverFlow"
            :top="props.ltop"
            :frame_name="props.lFrameName"
            class="w-16"
        />
        <h3
            class="font-bold text-sm text-center text-shadow-md"
            :class="config.textShadow"
        >
          {{ props.lUserName || 'User Name' }}
        </h3>
        <NuxtImg
            provider="imagekit"
            :src="config.decor"
            class="w-12"
        />
        <h3
            class="font-bold text-sm text-center text-shadow-md"
            :class="config.textShadow"
        >
          {{ props.rUserName || 'User Name' }}
        </h3>
        <Avatar
            :animated="true"
            :frame_overflow="props.rOverFlow"
            :top="props.rtop"
            :frame_name="props.rFrameName"
            class="w-16"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.just-flex-items-center {
  @apply flex justify-center items-center;
}
</style>
