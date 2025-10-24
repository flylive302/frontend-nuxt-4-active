<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  imageSrc?: string
  alt?: string
  to?: string | null               // if null → non-link card
  provider?: string
  quality?: number
  sizes?: string                   // responsive hint for NuxtImg
  rounded?: string                 // Tailwind radius for the card
  aspect?: string                  // Tailwind aspect utility
  badgeText?: string | null        // pill text; null hides the pill
}>(), {
  imageSrc: '/siteAssets/room/room-card-top.webp',
  alt: 'Room preview',
  to: '/room',
  provider: 'imagekit',
  quality: 70,
  sizes: '(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw',
  rounded: 'rounded-xl',
  aspect: 'aspect-[9/12]',
  badgeText: 'Live / 24',
})

// Use a link when `to` is provided, otherwise a neutral block wrapper
const Wrapper = computed(() => (props.to ? 'NuxtLink' : 'div'))

// Accessible name for the clickable region
const ariaLabel = computed(() => props.alt || 'Room')
</script>

<template>
  <component
      :is="Wrapper"
      v-bind="props.to ? { to: props.to, 'aria-label': ariaLabel } : {}"
      class="group block"
  >
    <article
        class="relative overflow-hidden border border-white/50 transition-shadow duration-200
             hover:shadow-lg focus-visible:shadow-lg
             focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30
             bg-black/5"
        :class="[props.rounded, props.aspect]"
    >
      <figure class="h-full w-full">
        <NuxtImg
            :provider="props.provider"
            :src="props.imageSrc"
            :alt="props.alt"
            :quality="props.quality"
            :sizes="props.sizes"
            class="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            placeholder="blur"
        />
        <figcaption class="sr-only">{{ props.alt }}</figcaption>
      </figure>

      <!-- Overlay content -->
      <aside class="pointer-events-none absolute inset-0 p-3 flex items-end">
        <template v-if="props.badgeText">
          <BgGlass
              frostBlurRadius="blur(4px)"
              rounded="rounded-full"
              class="pointer-events-auto flex items-center gap-1 px-1 w-fit rounded-full
                   border border-white/60 shadow-sm"
          >
            <!-- Live dot -->
            <span class="relative inline-flex">
              <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"></span>
              <span class="relative inline-block size-2 rounded-full bg-success border border-white/50"></span>
            </span>

            <!-- Text (slot overrideable) -->
            <p class="text-sm font-bold">
              <slot>{{ props.badgeText }}</slot>
            </p>
          </BgGlass>
        </template>
      </aside>
    </article>
  </component>
</template>

<style scoped>
/* Tailwind handles layout; minimal scoped CSS on purpose */
</style>
