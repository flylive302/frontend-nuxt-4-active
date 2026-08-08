<script setup lang="ts">
/**
 * LuckyCashbackCenter — the ONE persistent center cashback visual (INTENT).
 *
 * Pure state renderer: useLuckySessionStore.centerCashback drives everything.
 * Wins overwrite that state; this component never queues or replays events.
 * While visible it bounces gently at screen center; phase 'fading' runs the
 * CSS fade, which a new win interrupts instantly (phase flips back).
 *
 * The SVGA remounts only when tier or the shown win changes (`revision`), and
 * the tier files are pre-warmed on room entry, so a remount is a cached,
 * instant mount — not a network/parse stall.
 *
 * All timings come from LUCKY_ANIMATION (constants/lucky-animation.ts).
 */
import { LUCKY_ANIMATION } from '~/constants/lucky-animation'

const { centerCashback } = useLuckyGift()
</script>

<template>
  <div class="lucky-cashback-center" aria-hidden="true">
    <Transition name="cashback-pop">
      <div
        v-if="centerCashback"
        :key="`${centerCashback.tier}-${centerCashback.revision}`"
        class="lucky-cashback-center__stage"
        :class="{ 'lucky-cashback-center__stage--fading': centerCashback.phase === 'fading' }"
      >
        <div class="lucky-cashback-center__bounce">
          <LuckyCashbackSvga
            :multiplier="centerCashback.multiplier"
            :coins-won="centerCashback.coinsWon"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lucky-cashback-center {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 60;
}

/* ONE fixed anchor: every stage (including a leaving one during a win
   overwrite) is absolutely pinned to the same raised-center point, so the
   visual can never enter from a shifted/"random" position — old and new
   simply cross-fade in place. */
.lucky-cashback-center__stage {
  position: absolute;
  left: 50%;
  top: calc(50% - v-bind("`${LUCKY_ANIMATION.cashbackRaiseVh}vh`"));
  translate: -50% -50%;
  opacity: 1;
}

/* Fade-out: opacity transition only (GPU-friendly). A new win flips the phase
   class off, snapping opacity back to 1 instantly — the fade is interruptible
   by design. */
.lucky-cashback-center__stage--fading {
  opacity: 0;
  transition: opacity v-bind("`${LUCKY_ANIMATION.cashbackFadeDuration}ms`") ease-out;
}

/* Idle bounce while visible — transform-only, runs on the compositor. */
.lucky-cashback-center__bounce {
  animation: cashback-bounce
    v-bind("`${LUCKY_ANIMATION.cashbackBounceDuration}ms`")
    v-bind('LUCKY_ANIMATION.cashbackBounceEasing')
    infinite alternate;
}

@keyframes cashback-bounce {
  from {
    transform: translateY(calc(-1 * v-bind("`${LUCKY_ANIMATION.cashbackBounceDistancePx}px`")));
  }
  to {
    transform: translateY(v-bind("`${LUCKY_ANIMATION.cashbackBounceDistancePx}px`"));
  }
}

/* Entrance pop when the visual first appears */
.cashback-pop-enter-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out;
}
.cashback-pop-enter-from {
  transform: scale(0.6);
  opacity: 0;
}
.cashback-pop-leave-active {
  transition: opacity 0.2s ease-out;
}
.cashback-pop-leave-to {
  opacity: 0;
}
</style>
