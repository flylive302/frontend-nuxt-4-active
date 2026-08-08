<script setup lang="ts">
/**
 * LuckySenderBands — room-visible Lucky Gift activity bands (INTENT).
 *
 * One band per active sender, driven entirely by useLuckySessionStore
 * (senderBands). Taps and wins UPDATE a sender's existing band — a new DOM
 * node exists only per active sender, capped at LUCKY_ANIMATION.bandMaxVisible
 * by the slot system (bands without a slot stay in state, not in the DOM).
 *
 * Layout per band: avatar (image only, never the frame) · "sender sent gift
 * to recipient(s)" · accumulated +coins won · gold xN gift counter.
 * Slots stack downward from bandBaseTopPct with bandVerticalGapPx spacing —
 * bands can never overlap.
 *
 * All timings/positions come from LUCKY_ANIMATION (constants/lucky-animation.ts).
 */
import { LUCKY_ANIMATION } from '~/constants/lucky-animation'

const { visibleBands } = useLuckyGift()

/** Slot index → resting top position (base % of viewport + stacked px offset) */
function bandTop(slot: number | null): string {
  const pitch = LUCKY_ANIMATION.bandHeightPx + LUCKY_ANIMATION.bandVerticalGapPx
  return `calc(${LUCKY_ANIMATION.bandBaseTopPct}vh + ${(slot ?? 0) * pitch}px)`
}
</script>

<template>
  <div class="lucky-bands" aria-hidden="true">
    <TransitionGroup name="lucky-band">
      <div
        v-for="band in visibleBands"
        :key="band.senderId"
        class="lucky-band"
        :class="{ 'lucky-band--fading': band.phase === 'fading' }"
        :style="{ top: bandTop(band.slot) }"
      >
        <img
          v-if="band.senderAvatar"
          :src="band.senderAvatar"
          class="lucky-band__avatar"
          alt=""
          loading="eager"
          decoding="async"
        >
        <div v-else class="lucky-band__avatar lucky-band__avatar--empty" />

        <div class="lucky-band__text">
          <span class="lucky-band__line">
            {{ band.senderName }} sent {{ band.giftName }} to
            {{ band.recipientCount > 1 ? 'multiple users' : (band.recipientName ?? 'a user') }}
          </span>
          <span v-if="band.coinsWon > 0" class="lucky-band__coins">
            +{{ band.coinsWon.toLocaleString('en-US') }}
          </span>
        </div>

        <span class="lucky-band__quantity">x{{ band.quantity }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.lucky-bands {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 55;
}

.lucky-band {
  position: absolute;
  left: v-bind("`${LUCKY_ANIMATION.bandRestLeftPx}px`");
  display: flex;
  align-items: center;
  gap: 6px;
  height: v-bind("`${LUCKY_ANIMATION.bandHeightPx}px`");
  max-width: 78vw;
  padding: 0 10px 0 4px;
  border-radius: 9999px;
  background: linear-gradient(90deg, rgba(88, 28, 135, 0.85), rgba(30, 27, 75, 0.6));
  color: #fff;
  transition:
    top 0.3s ease-out,
    opacity v-bind("`${LUCKY_ANIMATION.bandFadeDuration}ms`") ease-out;
}

/* Inactivity fade — interrupted instantly when new activity flips the phase
   back to 'visible' (the class drops and opacity snaps to 1). */
.lucky-band--fading {
  opacity: 0;
}

.lucky-band__avatar {
  width: 32px;
  height: 32px;
  border-radius: 9999px;
  object-fit: cover;
  flex-shrink: 0;
}

.lucky-band__avatar--empty {
  background: rgba(255, 255, 255, 0.2);
}

.lucky-band__text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  font-size: 0.7rem;
  line-height: 1.15;
}

.lucky-band__line {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lucky-band__coins {
  color: #fde047;
  font-weight: 700;
}

.lucky-band__quantity {
  flex-shrink: 0;
  font-size: 1.1rem;
  font-weight: 800;
  background: linear-gradient(180deg, #fef08a, #f59e0b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

/* Entrance: fly in from bandEnterFromLeftPx to the resting position.
   transform-only, so it composites on the GPU. */
.lucky-band-enter-active {
  transition:
    transform v-bind("`${LUCKY_ANIMATION.bandEntranceDuration}ms`") v-bind('LUCKY_ANIMATION.bandEntranceEasing'),
    opacity v-bind("`${LUCKY_ANIMATION.bandEntranceDuration}ms`") ease-out;
}
.lucky-band-enter-from {
  transform: translateX(
    v-bind("`${LUCKY_ANIMATION.bandEnterFromLeftPx - LUCKY_ANIMATION.bandRestLeftPx}px`")
  );
  opacity: 0;
}
.lucky-band-leave-active {
  transition: opacity 0.2s ease-out;
}
.lucky-band-leave-to {
  opacity: 0;
}
</style>
