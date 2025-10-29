<script setup lang="ts">

type colors = "primary" | "secondary" | "tertiary" | "success" | "info" | "warning" | "danger";
// type variants = "ghost" | "soft" | "subtle" | "solid" | "link";

const props = withDefaults(defineProps<{
  color?: colors,
  backTo?: string,
  subMenuTo?: string | undefined,
  currentTo?: string,
  current?: string,
  linksTo?: string | undefined,
  links?: string | undefined,
}>(), {
  color: 'primary',
  backTo: '/',
  subMenuTo: undefined,
  currentTo: '/',
  current: 'Page Name',
  linksTo: undefined,
  links: "Page Name 2",
})
</script>
<template>
  <header
      aria-label="fly-live-alt-pages-header"
      class="fixed w-full z-50 top-0"
  >
    <BgGlass
        frost-blur-radius="blur(4px)"
        :noise-frequency="0.009"
        :noise-strength="200"
        rounded="rounded-none"
        class="grid grid-cols-8 px-2 py-1 border border-white/40"
    >
      <div class="col-span-1">
        <UButton
            aria-label="back-navigation-link"
            icon="i-lucide-chevron-left"
            size="md"
            variant="soft"
            :color="props.color"
            :to="props.backTo"
        />
      </div>

      <div class="col-span-6 flex gap-2">
        <UButton
            aria-label="current-page-link"
            size="md"
            variant="ghost"
            class="w-full justify-center"
            :to="props.currentTo"
        >
          {{ props.current }}
        </UButton>
        <UButton
            v-if="props.linksTo !== undefined"
            aria-label="Notifications"
            size="md"
            variant="ghost"
            class="w-full justify-center"
        >
          {{ props.links }}
        </UButton>
      </div>
      <div class="col-span-1 flex justify-end">
        <UButton
            v-if="props.subMenuTo !== undefined"
            aria-label="Notifications"
            icon="i-lucide-menu"
            size="md"
            :color="props.color"
            variant="soft"
        />
      </div>

    </BgGlass>
  </header>
</template>