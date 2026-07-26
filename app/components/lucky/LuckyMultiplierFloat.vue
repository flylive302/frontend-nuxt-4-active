<script setup lang="ts">
/**
 * LuckyMultiplierFloat
 *
 * Renders the sender-side lucky floaters in the room chat area, below the last
 * seats. Two shapes:
 *   - win  → a per-tier SVGA cashback animation (LuckyCashbackSvga)
 *   - notice → a small HTML text pill (no-draw hint)
 * ×0 busts produce no floater at all, so nothing is rendered for a loss.
 */
import type { FloatingMultiplier } from '~/types/lucky';
import { luckyFloatLanePct } from '~/utils/lucky-cashback';

// ============================================
// Props
// ============================================

defineProps<{
  /** Active floaters from useLuckyGift */
  floaters: readonly FloatingMultiplier[];
}>();
</script>

<template>
  <div class="lucky-float-container" aria-hidden="true">

    <TransitionGroup name="lucky-float">
      <div
        v-for="floater in floaters"
        :key="floater.id"
        class="lucky-float-item"
        :class="[floater.colorClass, floater.kind === 'multiplier' ? 'lucky-float-item--svga' : '']"
        :style="{ '--lane': `${luckyFloatLanePct(floater.id)}%` }"
      >
        <LuckyCashbackSvga
          v-if="floater.kind === 'multiplier'"
          :multiplier="floater.multiplier"
          :coins-won="floater.coinsWon"
        />
        <span v-else class="lucky-float-multiplier flex-middle">{{ floater.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.lucky-float-container {
  position: absolute;
  bottom: 60%;
  left: 10%;
  width: 80%;
  height: 200px;
  pointer-events: none;
  z-index: 50;
  overflow: visible;
}

.lucky-float-item {
  position: absolute;
  bottom: 10%;
  left: var(--lane, 50%);
  pointer-events: none;
  min-width: auto;
  height: auto;
  white-space: nowrap;
  animation: floatUp 80s ease-out forwards;
  transform: translateX(-50%);
}

/* SVGA win floater: the animation carries its own size + effects, so the
   wrapper only positions and floats it. */
.lucky-float-item--svga {
  width: auto;
  height: auto;
  text-shadow: none;
  border-radius: 0;
  animation: floatUpSvga 2.5s ease-out forwards;
}

.lucky-float-multiplier {
  display: inline-block;
}

/* Notice float: no-draw hint — subdued text pill, stays readable then fades */
.lucky-float--notice {
  color: #e5e7eb;
  background: rgba(17, 24, 39, 0.72);
  font-size: 0.8rem;
  font-weight: 600;
  width: auto;
  height: auto;
  padding: 0.35rem 0.7rem;
  border-radius: 9999px;
  text-shadow: none;
  white-space: nowrap;
  animation: floatUpNotice 3.5s ease-out forwards;
}

/* SVGA float-up: gentler rise, no scaling (the animation handles its own pop) */
@keyframes floatUpSvga {
  0% {
    opacity: 0;
    transform: translateY(10px) translateX(-50%);
  }
  12% {
    opacity: 1;
    transform: translateY(0) translateX(-50%);
  }
  80% {
    opacity: 1;
    transform: translateY(-70px) translateX(-50%);
  }
  100% {
    opacity: 0;
    transform: translateY(-110px) translateX(-50%);
  }
}

/* Notice float-up: fade in, hold to be read, then fade out */
@keyframes floatUpNotice {
  0% {
    opacity: 0;
    transform: translateY(0) translateX(-50%) scale(0.9);
  }
  10% {
    opacity: 1;
    transform: translateY(-10px) translateX(-50%) scale(1);
  }
  85% {
    opacity: 1;
    transform: translateY(-40px) translateX(-50%) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-60px) translateX(-50%) scale(0.95);
  }
}

/* Float-up animation */
@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateY(0) translateX(-50%) scale(0.6);
  }
  20% {
    opacity: 1;
    transform: translateY(-30px) translateX(-50%) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateY(-180px) translateX(-50%) scale(0.8);
  }
}

/* Vue TransitionGroup classes */
.lucky-float-enter-active {
  transition: all 0.3s ease-out;
}
.lucky-float-enter-from {
  opacity: 0;
  transform: scale(0.3) translateY(20px);
}
.lucky-float-leave-active {
  display: none;
}
</style>
