<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

type NavColor = 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error'

const props = withDefaults(defineProps<{
  color?: NavColor,
  backTo?: string,
  subMenuTo?: string | undefined,
  firstLink?: string | undefined,
  secondLink?: string | undefined,
  linked?: boolean,
}>(), {
  color: 'primary',
  backTo: '/',
  subMenuTo: undefined,
  firstLink: '/wallet/purchase-coins',
  secondLink: '/wallet/exchange-diamonds',
  linked: false,
})
const route = useRoute()

const gradientTargets: Record<NavColor, string> = {
  primary: 'to-primary/80',
  secondary: 'to-secondary/80',
  tertiary: 'to-tertiary/80',
  success: 'to-success/80',
  info: 'to-info/80',
  warning: 'to-warning/80',
  error: 'to-error/80',
}

const toGradient = computed(() => gradientTargets[props.color])
</script>
<template>
  <header
    aria-label="fly-live-alt-pages-header"
    class="fixed w-full z-50 top-0"
  >
    <BgGlass
      frost-blur-radius="blur(4px)"
      :noise-frequency="0.009"
      :noise-strength="10"
      rounded="rounded-none"
      class="grid grid-cols-8 border-b border-white/50"
    >
      <UButton
        aria-label="back-navigation-link"
        icon="i-lucide-chevron-left"
        size="md"
        variant="ghost"
        :color="color"
        :to="backTo"
        class="w-full justify-center rounded-none"
      />

      <p v-if="!linked" class="col-span-6 flex justify-center items-center text-base font-semibold">
        <slot />
      </p>

      <div v-else class="col-span-6 flex gap-2">
        <UButton
          aria-label="fist-page-link"
          size="md"
          :color="color"
          variant="link"
          :to="firstLink"
          class="w-full justify-center rounded-none bg-gradient-to-br"
          :class="route.path === firstLink ? toGradient : ''"
        >
          <slot name="first-link-text" />
        </UButton>
        <UButton
          aria-label="second page link"
          size="md"
          variant="link"
          :color="color"
          :to="secondLink"
          class="w-full justify-center rounded-none bg-gradient-to-br"
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
        :color="color"
        :to="subMenuTo"
        variant="ghost"
        class="w-full justify-center rounded-none"
      />
    </BgGlass>
  </header>
</template>
