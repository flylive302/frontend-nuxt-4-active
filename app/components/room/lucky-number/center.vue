<script setup lang="ts">
/**
 * RoomLuckyNumberCenter — the ONE centre element over the Seat grid (INTENT).
 *
 * Pure state renderer: while a round is live it shows the countdown; when
 * `luckyNumber:result` lands it shows the drawn number with a one-shot CSS
 * entrance, and useRoomEventHandlers removes it after the display duration.
 * No animation loop — one CSS keyframe, then static.
 */
import { LUCKY_NUMBER_NO_WINNER_TEXT } from '~/constants/lucky-number';

const { isRoundLive, secondsLeft, reveal } = useLuckyNumber();
</script>

<template>
  <div class="lucky-number-center" aria-live="polite">
    <Transition name="lucky-number-pop">
      <div
        v-if="reveal"
        :key="`reveal-${reveal.drawn}`"
        class="lucky-number-center__card lucky-number-center__card--reveal"
      >
        <span class="lucky-number-center__label">Lucky Number</span>
        <span class="lucky-number-center__digit">{{ reveal.drawn }}</span>
        <span v-if="reveal.winners.length === 0" class="lucky-number-center__label">
          {{ LUCKY_NUMBER_NO_WINNER_TEXT }}
        </span>
      </div>
      <div
        v-else-if="isRoundLive"
        key="countdown"
        class="lucky-number-center__card"
      >
        <span class="lucky-number-center__label">Lucky Number</span>
        <span class="lucky-number-center__digit tabular-nums">{{ secondsLeft }}</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.lucky-number-center {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 40;
  display: grid;
  place-items: center;
}

.lucky-number-center__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: 0.75rem 1.5rem;
  border-radius: 1rem;
  background: rgb(0 0 0 / 0.55);
  backdrop-filter: blur(6px);
  color: white;
  text-align: center;
}

.lucky-number-center__label {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.85;
}

.lucky-number-center__digit {
  font-size: 3.5rem;
  line-height: 1;
  font-weight: 800;
}

/* One-shot entrance for the reveal; runs once, then the element sits still. */
.lucky-number-center__card--reveal {
  animation: lucky-number-reveal 420ms cubic-bezier(0.2, 1.4, 0.4, 1) both;
}

@keyframes lucky-number-reveal {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.lucky-number-pop-enter-active,
.lucky-number-pop-leave-active {
  transition: opacity 200ms ease;
}
.lucky-number-pop-enter-from,
.lucky-number-pop-leave-to {
  opacity: 0;
}
</style>
