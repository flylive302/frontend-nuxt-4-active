<script setup lang="ts">
import { computed } from 'vue'

type CardType = 'cp' | 'country' | 'pretty_id' | 'recharge_tycoon' | 'supreme_recharge'

interface Props {
  type?: CardType
  lUserName?: string
  lAvatar?: string
  lFrameName?: string
  lOverFlow?: number
  lTop?: number
  rUserName?: string
  rAvatar?: string
  rFrameName?: string
  rOverFlow?: number
  rTop?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'cp',
  lUserName: 'Male User',
  lAvatar: '',
  lFrameName: 'frames/events/cp',
  lOverFlow: 150,
  lTop: 50,
  rUserName: 'Female User',
  rAvatar: '',
  rFrameName: 'frames/5',
  rOverFlow: 150,
  rTop: 50
})

const typeConfig = {
  cp: {
    banner: '/siteAssets/banners/cp.webp',
    header: '/siteAssets/banners/cp-header.webp',
    decor: '/siteAssets/banners/decor-main-content.webp',
    shadowClass: 'shadow-primary/30',
    textShadow: 'text-shadow-primary'
  },
  country: {
    banner: '/siteAssets/banners/country.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-success/30',
    textShadow: 'text-shadow-success'
  },
  pretty_id: {
    banner: '/siteAssets/banners/pretty-id.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-secondary/30',
    textShadow: 'text-shadow-secondary'
  },
  recharge_tycoon: {
    banner: '/siteAssets/banners/recharge-tycoon.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-tertiary/30',
    textShadow: 'text-shadow-tertiary'
  },
  supreme_recharge: {
    banner: '/siteAssets/banners/supreme_recharge.webp',
    header: '/siteAssets/banners/country-header.svg',
    decor: '/siteAssets/banners/decor-recharge-tycoon.webp',
    shadowClass: 'shadow-secondary/30',
    textShadow: 'text-shadow-secondary'
  }
} as const satisfies Record<CardType, {
  banner: string
  header: string
  decor: string
  shadowClass: string
  textShadow: string
}>

const config = computed(() => typeConfig[props.type])
</script>

<template>
  <article
      class="relative rounded-lg border border-white/50 shadow-lg"
      :class="config.shadowClass"
  >
    <!-- Decorative banner background -->
    <NuxtImg
        provider="imagekit"
        :src="config.banner"
        alt=""
        aria-hidden="true"
        class="absolute inset-0 rounded-lg object-cover h-full w-full"
        sizes="(max-width: 640px) 100vw, 640px"
    />

    <div class="relative">
      <!-- Header -->
      <header class="flex items-center justify-center">
        <NuxtImg
            provider="imagekit"
            :src="config.header"
            alt=""
            aria-hidden="true"
            class="h-8 -mt-3"
            sizes="(max-width: 640px) 50vw, 320px"
        />
        <h2
            class="absolute inset-0 -mt-3 text-center text-lg font-bold text-shadow-lg"
            :class="config.textShadow"
        >
          <slot />
        </h2>
      </header>

      <!-- Main content -->
      <main class="flex items-center justify-center p-2">
        <!-- Left user -->
        <figure class="flex items-center">
          <Avatar
              :animated="true"
              :frame_overflow="props.lOverFlow"
              :top="props.lTop"
              :frame_name="props.lFrameName"
              class="w-14"
          />
          <figcaption class="text-center text-sm font-bold text-shadow-md" :class="config.textShadow">
            {{ props.lUserName || 'User Name' }}
          </figcaption>
        </figure>

        <!-- Decor element -->
        <NuxtImg
            provider="imagekit"
            :src="config.decor"
            alt=""
            aria-hidden="true"
            class="w-16"
            sizes="48px"
        />

        <!-- Right user -->
        <figure class="flex items-center">
          <figcaption class="text-center text-sm font-bold text-shadow-md" :class="config.textShadow">
            {{ props.rUserName || 'User Name' }}
          </figcaption>
          <Avatar
              :animated="true"
              :frame_overflow="props.rOverFlow"
              :top="props.rTop"
              :frame_name="props.rFrameName"
              class="w-14"
          />
        </figure>
      </main>
    </div>
  </article>
</template>
