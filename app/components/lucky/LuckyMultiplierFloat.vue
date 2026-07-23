<script setup lang="ts">
/**
 * LuckyMultiplierFloat
 *
 * Renders floating multiplier text animations (similar to emoji reactions).
 * Each float rises upward and fades out over 2.5s.
 * Mounted in the room chat area, below the last seats.
 */
import type { FloatingMultiplier } from '~/types/lucky';

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
        :class="floater.colorClass"
        :style="{ '--x-offset': `${(floater.id % 3) * 20 - 30}px` }"
      >
        <span class="lucky-float-multiplier flex-middle">
          <template v-if="floater.kind === 'notice'">{{ floater.text }}</template>
          <template v-else>×{{ floater.multiplier }}</template>
        </span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.lucky-float-container {
  position: absolute;
  bottom: 60%;
  left: 0;
  width: 200px;
  height: 200px;
  pointer-events: none;
  z-index: 50;
  overflow: visible;
}

.lucky-float-item {
  --color-tiny: rgba(241, 174, 73, 0.99);
  position: absolute;
  bottom: 10%;
  left: 50%;
  font-weight: 800;
  font-size: 1.5rem;
  width: 1.8rem;
  height: 1.8rem;
  text-shadow: 0 2px 8px rgba(92, 92, 92, 0.5);
  white-space: nowrap;
  animation: floatUp 2s ease-out forwards;
  transform: translateX(var(--x-offset, 0));
  border-radius: 100%;
}

/* Tier color classes */
.lucky-float--bust {
  color: rgb(255 255 255);
  font-weight: 800;
  font-size: 1.3rem;
  text-shadow: none;
  animation: floatUpBust 2s ease-out forwards;
}

.lucky-float--tiny {
  color: white;
  background: var(--color-tiny);
  font-size: 1rem;
}

.lucky-float--good {
  color: #48bb78;
  font-size: 1.3rem;
}

.lucky-float--great {
  color: #4ade80;
  font-size: 1.7rem;
  text-shadow: 0 0 12px rgba(74, 222, 128, 0.6);
}

.lucky-float--epic {
  color: #ed8936;
  font-size: 2rem;
  text-shadow: 0 0 16px rgba(237, 137, 54, 0.7), 0 0 32px rgba(237, 137, 54, 0.35);
}

.lucky-float--jackpot {
  color: #f56565;
  font-size: 2.4rem;
  text-shadow: 0 0 20px rgba(245, 101, 101, 0.8), 0 0 40px rgba(245, 101, 101, 0.4);
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

/* Bust float: subdued (no pop/glow), but stays visible as long as a win so a
   loss reads as a result — holds opacity then fades on the win schedule. */
@keyframes floatUpBust {
  0% {
    opacity: 1;
    transform: translateY(0) translateX(var(--x-offset, 0)) scale(1.1);
  }
  20% {
    opacity: 1;
    transform: translateY(-30px) translateX(var(--x-offset, 0)) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: translateY(-180px) translateX(var(--x-offset, 0)) scale(0.9);
  }
}

/* Notice float-up: fade in, hold to be read, then fade out */
@keyframes floatUpNotice {
  0% {
    opacity: 0;
    transform: translateY(0) translateX(var(--x-offset, 0)) scale(0.9);
  }
  10% {
    opacity: 1;
    transform: translateY(-10px) translateX(var(--x-offset, 0)) scale(1);
  }
  85% {
    opacity: 1;
    transform: translateY(-40px) translateX(var(--x-offset, 0)) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-60px) translateX(var(--x-offset, 0)) scale(0.95);
  }
}

/* Float-up animation */
@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateY(0) translateX(var(--x-offset, 0)) scale(0.6);
  }
  20% {
    opacity: 1;
    transform: translateY(-30px) translateX(var(--x-offset, 0)) scale(1.2);
  }
  100% {
    opacity: 0;
    transform: translateY(-180px) translateX(var(--x-offset, 0)) scale(0.8);
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
