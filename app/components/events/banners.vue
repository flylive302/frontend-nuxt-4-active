<script setup lang="ts">
import { computed } from 'vue'
import { EVENT_BANNERS } from '~/constants/assets'

defineOptions({ name: 'DuelEventCard' })

// ---- Types
type CardType = 'cp' | 'country' | 'pretty_id' | 'recharge_tycoon' | 'supreme_recharge'

interface Props {
  type?: CardType
  lUserName?: string
  lAvatar?: string
  lFrameName?: string
  lFrameGirth?: number
  lTop?: number
  rUserName?: string
  rAvatar?: string
  rFrameName?: string
  rFrameGirth?: number
  rTop?: number
}

// ---- Static config (frozen for perf)
const TYPE_CONFIG = Object.freeze({
  cp: {
    ...EVENT_BANNERS.cp,
    shadowClass: 'shadow-primary/30',
    textShadow: 'text-shadow-primary'
  },
  country: {
    ...EVENT_BANNERS.country,
    shadowClass: 'shadow-success/30',
    textShadow: 'text-shadow-success'
  },
  pretty_id: {
    ...EVENT_BANNERS.pretty_id,
    shadowClass: 'shadow-secondary/30',
    textShadow: 'text-shadow-secondary'
  },
  recharge_tycoon: {
    ...EVENT_BANNERS.recharge_tycoon,
    shadowClass: 'shadow-tertiary/30',
    textShadow: 'text-shadow-tertiary'
  },
  supreme_recharge: {
    ...EVENT_BANNERS.supreme_recharge,
    shadowClass: 'shadow-secondary/30',
    textShadow: 'text-shadow-secondary'
  }
} as const satisfies Record<
    CardType,
    { banner: string; header: string; decor: string; shadowClass: string; textShadow: string }
>)

const props = withDefaults(defineProps<Props>(), {
  type: 'cp',
  lUserName: 'Male User',
  lAvatar: '',
  lFrameName: 'frames/events/cp_1',
  lFrameGirth: 70,
  lTop: 50,
  rUserName: 'Female User',
  rAvatar: '',
  rFrameName: 'frames/events/cp_2',
  rFrameGirth: 70,
  rTop: 50
})

// Compute once per prop change; auto-unwrapped in template
const config = computed(() => TYPE_CONFIG[props.type])

const leftAvatarBindings = computed(() =>
  props.lAvatar ? { img: props.lAvatar } : {}
)
const rightAvatarBindings = computed(() =>
  props.rAvatar ? { img: props.rAvatar } : {}
)

// a11y: link heading to article
const headingId = `duel-card-title-${props.type}`
</script>

<template>
  <article
      class="relative"
      :class="config.shadowClass"
      :aria-labelledby="headingId"
  >
    <!-- Decorative banner background -->
    <NuxtImg
        :src="config.banner"
        alt=""
        aria-hidden="true"
        width="360"
        height="120"
        sizes="(max-width: 768px) 85vw, 360px"
        class="select-none absolute inset-0 h-full w-full object-cover rounded-lg border border-white/50 shadow-lg"
        loading="lazy"
        decoding="async"
    />

    <div class="relative">
      <!-- Header -->
      <header class="relative flex items-center justify-center">
        <NuxtImg
            :src="config.header"
            alt=""
            aria-hidden="true"
            width="280"
            height="32"
            sizes="280px"
            class="h-8 w-auto max-w-[min(280px,85vw)] -mt-3"
            loading="lazy"
            decoding="async"
        />
        <h2
            :id="headingId"
            class="absolute inset-0 -mt-3 text-center text-lg font-bold text-shadow-md"
            :class="config.textShadow"
        >
          <slot />
        </h2>
      </header>

      <!-- Main content -->
      <main class="grid grid-cols-7 items-center">
        <!-- Left user -->
        <figure class="col-span-3 grid grid-cols-2">
          <UserAvatar
              :animated="true"
              defer-frame-animation
              :frame-girth="props.lFrameGirth"
              :top="props.lTop"
              :frame-name="props.lFrameName"
              v-bind="leftAvatarBindings"
              class="col-span-1"
          />
          <figcaption class="text-xs font-bold text-shadow-md w-full col-span-1" :class="config.textShadow">
            {{ props.lUserName || 'User Name' }}
          </figcaption>
        </figure>
        <!-- Decor element -->
        <NuxtImg
            :src="config.decor"
            alt=""
            aria-hidden="true"
            width="80"
            height="80"
            sizes="80px"
            class="col-span-1"
            loading="lazy"
            decoding="async"
        />
        <!-- Right user -->
        <figure class="col-span-3 grid grid-cols-2">
          <figcaption class="text-right text-xs font-bold text-shadow-md col-span-1" :class="config.textShadow">
            {{ props.rUserName || 'User Name' }}
          </figcaption>
          <UserAvatar
              :animated="true"
              defer-frame-animation
              :frame-girth="props.rFrameGirth"
              :top="props.rTop"
              :frame-name="props.rFrameName"
              v-bind="rightAvatarBindings"
              class="col-span-1"
          />
        </figure>
      </main>
    </div>
  </article>
</template>

<style scoped>
  main > * {
    align-items: center;
  }
</style>
