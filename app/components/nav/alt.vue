<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'

type colors = "primary" | "secondary" | "tertiary" | "success" | "info" | "warning" | "danger";

const props = withDefaults(defineProps<{
  color?: colors,
  backTo?: string,
  subMenuTo?: string | undefined,
  current?: string,
  linksTo?: string | undefined,
  links?: string | undefined,
}>(), {
  color: 'primary',
  backTo: '/',
  subMenuTo: undefined,
  current: 'Page Name',
  linksTo: undefined,
  links: "Page Name 2",
})
const route = useRoute();
const variants = computed(() => {
  const isActive = props.linksTo && route.path === props.linksTo
  return {
    current: isActive ? 'link' : 'subtle',
    link: isActive ? 'subtle' : 'link'
  }
});
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
          variant="subtle"
          :color="color"
          :to="backTo"
          class="w-full justify-center rounded-none"
      />

      <div class="col-span-6 flex gap-2">
        <UButton
            aria-label="current-page-link"
            size="md"
            :variant="variants.current"
            :color="color"
            class="w-full justify-center rounded-none"
        >
          {{ current }}
        </UButton>
        <UButton
            v-if="linksTo !== undefined"
            aria-label="Notifications"
            size="md"
            :variant="variants.link"
            :color="color"
            :to="linksTo"
            class="w-full justify-center rounded-none"
        >
          {{ links }}
        </UButton>
      </div>
      <UButton
          v-if="subMenuTo !== undefined"
          aria-label="Notifications"
          icon="i-lucide-menu"
          size="md"
          :color="color"
          variant="soft"
          class="w-full justify-center rounded-none"
      />
    </BgGlass>
  </header>
</template>