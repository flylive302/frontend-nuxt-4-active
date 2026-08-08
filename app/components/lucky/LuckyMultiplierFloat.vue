<script setup lang="ts">
/**
 * LuckyMultiplierFloat
 *
 * Renders the sender-side no-draw notice pills in the room chat area, below
 * the last seats. Win cashback no longer floats here — it renders as the ONE
 * state-driven center animation (LuckyCashbackCenter), so rapid wins can
 * never queue up as a backlog of floaters.
 */
import type { FloatingMultiplier } from '~/types/lucky';
import { luckyFloatLanePct } from '~/utils/lucky-cashback';

// ============================================
// Props
// ============================================

defineProps<{
  /** Active floaters from useLuckyGift (notices only) */
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
        :class="floater.colorClass"
        :style="{ '--lane': `${luckyFloatLanePct(floater.id)}%` }"
      >
        <span v-if="floater.kind === 'notice'" class="lucky-float-multiplier flex-middle">
          {{ floater.text }}
        </span>
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
  transform: translateX(-50%);
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
