<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  imageSrc?: string
  alt?: string
  to?: string | null               // if null → non-link card
  provider?: string
  quality?: number
  rounded?: string                 // Tailwind radius for the card
  aspect?: string                  // Tailwind aspect utility
  badgeText?: string | null        // pill text; null hides the pill
}>(), {
  imageSrc: '/siteAssets/room/room-card-top.webp',
  alt: 'Room preview',
  to: '/room',
  provider: 'imagekit',
  quality: 80,
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
    <article class="relative overflow-hidden border border-white/50" :class="[props.rounded, props.aspect]">
      <figure class="h-full w-full">
        <NuxtImg
            :provider="props.provider"
            :src="props.imageSrc"
            :alt="props.alt"
            :quality="props.quality"
            class="h-full w-full object-cover"
            placeholder="blur"
            preload
        />
        <figcaption class="sr-only">{{ props.alt }}</figcaption>
      </figure>

      <!-- Overlay content -->
      <aside class="pointer-events-none absolute inset-0 p-3 flex items-end">
        <template v-if="props.badgeText">
          <BgGlass
              frost-blur-radius="blur(4px)"
              rounded="rounded-full"
              class="flex items-center gap-1 px-1 w-fit rounded-full border border-white/60"
          >
            <!-- Live dot -->
            <span class="relative inline-flex">
              <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
              <span class="relative inline-block size-2 rounded-full bg-success"/>
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
