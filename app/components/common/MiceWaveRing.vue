<!-- ~/components/common/MiceWaveRing.vue -->
<!-- Shared presentational ring for mice-wave prop displays (svga-removal 05). -->
<!-- Renders the same breathing ring as the room seat's speaking indicator -->
<!-- (`room/seat.vue` `.speaking-ring` / `seat-ring-breathe`), reused -->
<!-- wherever a mice-wave prop is shown outside a seat: mall listing card -->
<!-- (static), prop preview modals (animated), recharge-activity rewards, VIP -->
<!-- prop preview. Color comes from `resolveMiceWaveRingColor` (svga-removal 01) -->
<!-- — never duplicate that resolution logic at the call site. -->
<!--
  Deliberately NOT its own clipped/rounded frame: the box-shadow ring and its
  scale-up breathe past the ring's own box, so any `overflow-hidden` ancestor
  (list-card thumbnails, modal preview containers) clips the pulse. Callers provide their own frame
  (aspect-square + background) exactly like PropAssetView does for every
  other prop type; this component only centers a ring sized relative to its
  parent, with room left for the pulse to breathe.
-->
<script setup lang="ts">
defineOptions({ name: 'MiceWaveRing' })

withDefaults(
  defineProps<{
    /** Validated CSS color, from `resolveMiceWaveRingColor`. */
    color: string
    /** Pulse like the seat's speaking ring. False = static ring (e.g. list thumbnails). */
    animated?: boolean
  }>(),
  {
    animated: true,
  },
)
</script>

<template>
  <div class="flex items-center justify-center w-full h-full p-2">
    <span
      class="mice-wave-ring w-1/2 aspect-square rounded-full"
      :class="{ 'mice-wave-ring--animated': animated }"
      :style="{ '--seat-ring-color': color }"
    />
  </div>
</template>

<style scoped>
/* Mirrors room/seat.vue's .speaking-ring / seat-ring-breathe exactly (same
   keyframes/timing) so the ring reads identically wherever it appears.
   Static box-shadow; only transform + opacity animate (compositor-only, no
   per-frame repaint) — see the note in seat.vue. */
.mice-wave-ring {
  box-shadow: 0 0 0 3px var(--seat-ring-color, #f97316);
}

.mice-wave-ring--animated {
  animation: mice-wave-ring-breathe 1.2s ease-in-out infinite;
}

@keyframes mice-wave-ring-breathe {
  0%, 100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mice-wave-ring--animated {
    animation: none;
    box-shadow: 0 0 0 5px var(--seat-ring-color, #f97316);
    opacity: 0.8;
  }
}
</style>
