<script setup lang="ts">
/**
 * Full-screen game shell — our own header bar over a viewport-sized layer.
 *
 * INTENT only: it draws the layer and reports `back` / `close`. What those do is
 * the parent's call.
 *
 * Why a Teleport and not the drawer: the stock drawer content is `fixed … mt-24
 * max-h-[96%]` and is transformed while it animates, so a `fixed inset-0` child
 * inside it is not viewport-fixed — it would be clipped to the sheet. This layer
 * lives on `<body>`, outside the room's stacking context and outside the drawer,
 * which is also why the drawer is closed while it is shown.
 *
 * z-index 90: above the room root (z-50), the chat composer (z-60) and every
 * Nuxt UI drawer/modal (which set none), level with LevelUpModal, and BELOW the
 * toaster (z-100) so a toast is still readable over a running game.
 *
 * The room keeps running underneath — its audio is not touched — so this is a
 * cover, not a navigation.
 */
defineProps<{
  open: boolean;
  title: string;
}>();

const emit = defineEmits<{
  back: [];
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <!--
      `pointer-events-auto`: a modal Reka layer (the drawer, just before this layer
      takes over) sets `pointer-events: none` on <body> while it is mounted
      (reka-ui/dist/DismissableLayer/DismissableLayer.js:82-83), and a raw Teleport
      child inherits that. Without this the first taps could be dead.
    -->
    <div
      v-if="open"
      class="pointer-events-auto fixed inset-0 z-90 flex flex-col bg-default safe-area-bottom"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
    >
      <!-- The safe-area inset sits on the wrapper so the bar's background reaches the notch. -->
      <header class="shrink-0 border-b border-default safe-area-top">
        <div class="flex h-14 items-center justify-between gap-2 px-2">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="xl"
            square
            class="size-11 shrink-0"
            aria-label="Back to games"
            @click="emit('back')"
          />

          <p class="min-w-0 flex-1 truncate text-center text-base font-semibold text-highlighted">
            {{ title }}
          </p>

          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xl"
            square
            class="size-11 shrink-0"
            aria-label="Close games"
            @click="emit('close')"
          />
        </div>
      </header>

      <div class="relative min-h-0 flex-1">
        <slot />
      </div>
    </div>
  </Teleport>
</template>
