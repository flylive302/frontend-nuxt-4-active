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
 *
 * Phone sideways (`short-landscape:`, main.css): the bar would eat ~15% of the
 * height a landscape game (Fly Snooker) needs, so it floats OVER the game instead —
 * no background, no title, just ← and ✕ as round dark buttons in the corners. The
 * header is `pointer-events-none` so taps between the buttons reach the game; only
 * the buttons take taps. Portrait and tall screens keep the solid bar.
 */
// ⚠️ One LITERAL string: Tailwind reads classes from source text. Sideways the
// ghost button's own hover/active backgrounds would win over a plain bg, so the
// scrim is restated for each state; touch devices never apply `hover:` (v4 wraps
// it in `@media (hover: hover)`), so it cannot stick after a tap.
const BAR_BUTTON_CLASS =
  'size-11 shrink-0 short-landscape:pointer-events-auto short-landscape:rounded-full short-landscape:bg-black/55 short-landscape:text-white short-landscape:ring-1 short-landscape:ring-white/25 short-landscape:hover:bg-black/75 short-landscape:active:bg-black/75 short-landscape:focus-visible:bg-black/75';

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
      <!--
        The safe-area inset sits on the wrapper so the bar's background reaches the notch.
        Sideways: absolute + z-10 so it paints ABOVE the positioned game container that
        follows it in the DOM (without a z-index it would sit under the iframe).
      -->
      <header
        class="shrink-0 border-b border-default safe-area-top short-landscape:pointer-events-none short-landscape:absolute short-landscape:inset-x-0 short-landscape:top-0 short-landscape:z-10 short-landscape:border-b-0"
      >
        <div
          class="flex h-14 items-center justify-between gap-2 px-2 short-landscape:pl-[max(0.5rem,env(safe-area-inset-left))] short-landscape:pr-[max(0.5rem,env(safe-area-inset-right))]"
        >
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="ghost"
            size="xl"
            square
            :class="BAR_BUTTON_CLASS"
            aria-label="Back to games"
            @click="emit('back')"
          />

          <!-- Sideways the dialog's aria-label still names the game. -->
          <p class="min-w-0 flex-1 truncate text-center text-base font-semibold text-highlighted short-landscape:invisible">
            {{ title }}
          </p>

          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xl"
            square
            :class="BAR_BUTTON_CLASS"
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
