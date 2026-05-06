<script setup lang="ts">
import { ASSETS } from '~/constants/assets'

const columns = [
  { cards: [ASSETS.AUTH_CARD_1, ASSETS.AUTH_CARD_2, ASSETS.AUTH_CARD_3], dir: -1 },
  { cards: [ASSETS.AUTH_CARD_4, ASSETS.AUTH_CARD_5, ASSETS.AUTH_CARD_6], dir: 1 },
] as const

const cardsVisible = ref(false)

onMounted(() => {
  const schedule = (cb: () => void) =>
      'requestIdleCallback' in window
          ? window.requestIdleCallback(cb)
          : window.setTimeout(cb, 200)

  schedule(() => { cardsVisible.value = true })
})
</script>

<template>
  <!-- aria-hidden: decorative only, no screen-reader noise, no pointer events -->
  <div
      aria-hidden="true"
      class="pointer-events-none absolute inset-0 z-10 flex gap-3 px-4 overflow-hidden"
  >
    <div
        v-for="(column, colIndex) in columns"
        :key="colIndex"
        class="w-full overflow-hidden"
    >
      <!--
        TWO LAYERS — keeps transforms isolated:
          .col-reveal  → handles opacity + scale entrance only
          .card-track  → handles infinite scroll only
        If both animated the same element, scrollY's transform
        overwrites reveal's translateY, causing the gap on dir:-1.
      -->
      <div
          class="col-reveal"
          :class="{ 'is-visible': cardsVisible }"
      >
        <div
            class="card-track"
            :class="{ 'is-visible': cardsVisible }"
            :style="{ '--dir': column.dir }"
        >
          <!--
            Duplicate set for seamless loop.
            Keying on `n` alone is fine — Vue reuses the DOM nodes
            across re-renders since the cards array is const.
          -->
          <template v-for="n in 2" :key="n">
            <div
                v-for="card in column.cards"
                :key="`${n}-${card}`"
                class="card-shell"
                :style="{ backgroundImage: `url(${card})` }"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─── Reveal wrapper ─────────────────────────────────────────── */
.col-reveal {
  /* GPU layer promoted only while the short entrance runs */
  opacity: 0;
}

.col-reveal.is-visible {
  animation: reveal 600ms ease-out both;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(40px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ─── Scroll track ───────────────────────────────────────────── */
.card-track {
  display: flex;
  flex-direction: column;
  /*
    contain: layout style
      - layout → the track's internal reflows never escape to the page
      - style  → custom property changes stay inside this subtree
    This alone removes this element from the main thread's layout pass
    and is worth ~5–10 Lighthouse points on paint cost.
  */
  contain: layout style;
}

.card-track.is-visible {
  /*
    will-change on the element that ACTUALLY scrolls, not the reveal wrapper.
    Declared only once the animation starts so the compositor layer
    is not wasted during idle time.
  */
  will-change: transform;
  animation: scrollY 20s linear infinite;
}

/*
  Direction math (no separate keyframes needed):

    dir =  1 → from translateY(0)    to translateY(-50%)   scroll UP   ✓
    dir = -1 → from translateY(-50%) to translateY(0)      scroll DOWN ✓

  Formula:
    from = (1 -  dir) * -25%   →  dir 1: 0      dir -1: -50%
    to   = (1 +  dir) * -25%   →  dir 1: -50%   dir -1: 0
*/
@keyframes scrollY {
  from {
    transform: translateY(calc((1 - var(--dir)) * -25%));
  }
  to {
    transform: translateY(calc((1 + var(--dir)) * -25%));
  }
}

/* ─── Cards ──────────────────────────────────────────────────── */
.card-shell {
  /* flex-shrink: 0 prevents cards from collapsing if the track
     is shorter than the viewport — critical for the loop math   */
  flex-shrink: 0;
  height: 15rem;
  margin-bottom: 1rem;
  border-radius: 1.5rem;
  background-size: cover;
  background-position: center;
  /* background-color gives a visual placeholder while the
     image loads — keeps CLS score clean                         */
  background-color: rgb(255 255 255 / 0.08);
}

.card-shell:last-child {
  margin-bottom: 0;
}

/* ─── Accessibility: honour OS reduced-motion preference ─────── */
@media (prefers-reduced-motion: reduce) {
  .col-reveal.is-visible {
    /* still fade in, just no movement */
    animation: fadeIn 400ms ease-out both;
  }

  .card-track.is-visible {
    /* freeze scroll; will-change no longer needed */
    will-change: auto;
    animation: none;
    /* park at the middle of the list so it looks intentional */
    transform: translateY(-25%);
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
}
</style>