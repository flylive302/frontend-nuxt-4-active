<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { Colors } from '~/types/colors'

const props = withDefaults(defineProps<{
  color?: Colors,
  backTo?: string,
  subMenuTo?: string | undefined,
  firstLink?: string | undefined,
  secondLink?: string | undefined,
  linked?: boolean,
  /**
   * Render an in-flow spacer matching the device safe-area inset (status bar).
   * The header is `fixed` and padded down by `safe-area-top` on native, but
   * page content isn't — so `pt-14`-style page offsets that clear the bar on
   * web slide under it on Capacitor. Zero-height on web (inset = 0), so
   * opting in never changes the web layout. Leave off for pages that
   * intentionally underlay content (heroes, bg videos).
   */
  spacer?: boolean,
}>(), {
  color: 'primary',
  backTo: '/',
  subMenuTo: undefined,
  firstLink: '/coins/request',
  secondLink: '/coins/exchange',
  linked: false,
  spacer: false,
})
const route = useRoute()

const gradientTargets: Record<Colors, string> = {
  primary: 'to-primary/80',
  secondary: 'to-secondary/80',
  tertiary: 'to-tertiary/80',
  success: 'to-success/80',
  info: 'to-info/80',
  warning: 'to-warning/80',
  error: 'to-error/80',
}

const toGradient = computed(() => gradientTargets[props.color])

const uiColor = computed(() => props.color)
</script>
<template>
  <header
    aria-label="fly-live-alt-pages-header"
    class="fixed w-full z-50 top-0 safe-area-top"
  >
    <div class="grid grid-cols-8 border-b border-white/50 backdrop-blur-xs" >
      <UButton
        aria-label="back-navigation-link"
        icon="i-lucide-chevron-left"
        size="md"
        variant="ghost"
        :color="uiColor"
        :to="backTo"
        class="w-full justify-center rounded-none"
      />

      <p v-if="!linked" class="col-span-6 flex justify-center items-center text-base font-semibold">
        <slot />
      </p>

      <div v-else class="col-span-6 flex gap-2">
        <UButton
          aria-label="first-page-link"          
          size="md"
          :color="uiColor"
          variant="link"
          :to="firstLink"
          class="w-full justify-center rounded-none bg-linear-to-br"
          :class="route.path === firstLink ? toGradient : ''"
        >
          <slot name="first-link-text" />
        </UButton>
        <UButton
          aria-label="second page link"
          size="md"
          variant="link"
          :color="uiColor"
          :to="secondLink"
          class="w-full justify-center rounded-none bg-linear-to-br"
          :class="route.path === secondLink ? toGradient : ''"
        >
          <slot name="second-link-text" />
        </UButton>
      </div>
      <UButton
        v-if="subMenuTo !== undefined"
        aria-label="Notifications"
        icon="i-lucide-menu"
        size="md"
        :color="uiColor"
        :to="subMenuTo"
        variant="ghost"
        class="w-full justify-center rounded-none"
      />
    </div>
  </header>
  <div v-if="props.spacer" class="safe-area-top" aria-hidden="true" />
</template>
