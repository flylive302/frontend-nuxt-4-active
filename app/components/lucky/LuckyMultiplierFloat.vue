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
          ×{{ floater.multiplier }}
        </span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.lucky-float-container {
  position: absolute;
  bottom: 30%;
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
  color: #4299e1;
  font-size: 1.5rem;
}

.lucky-float--epic {
  color: #ed8936;
  font-size: 1.8rem;
  text-shadow: 0 0 12px rgba(237, 137, 54, 0.6);
}

.lucky-float--jackpot {
  color: #f56565;
  font-size: 2.2rem;
  text-shadow: 0 0 20px rgba(245, 101, 101, 0.8), 0 0 40px rgba(245, 101, 101, 0.4);
}

.lucky-float-multiplier {
  display: inline-block;
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
