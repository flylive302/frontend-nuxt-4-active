<script setup lang="ts">
/**
 * Gift Combo Button
 *
 * Floating combo button with circular progress indicator.
 * Teleported to body for z-index safety.
 */
import { COMBO_BUTTON_TIMEOUT_MS } from '~/constants/gift';

const props = withDefaults(
  defineProps<{
    timeoutMs?: number;
  }>(),
  {
    timeoutMs: COMBO_BUTTON_TIMEOUT_MS,
  }
);

const emit = defineEmits<{
  click: [];
  timeout: [];
}>();

const giftStore = useGiftStore();

// Progress animation state
const progressPercent = ref(0);
let animationFrameId: number | null = null;
let startTime = 0;

/**
 * Start the progress animation timer
 */
function startProgress() {
  if (animationFrameId) cancelAnimationFrame(animationFrameId);

  progressPercent.value = 0;
  startTime = performance.now();

  const update = (currentTime: number) => {
    const elapsedMs = currentTime - startTime;
    const progressRatio = Math.min(elapsedMs / props.timeoutMs, 1);

    progressPercent.value = Math.round(progressRatio * 100);

    if (progressRatio < 1) {
      animationFrameId = requestAnimationFrame(update);
    } else {
      animationFrameId = null;
      emit('timeout');
    }
  };

  animationFrameId = requestAnimationFrame(update);
}

/**
 * Reset the timer (called on combo click)
 */
function resetTimer() {
  startProgress();
}

/**
 * Handle combo button click
 */
function handleClick(event: Event) {
  // Prevent event from bubbling to drawer
  event.stopPropagation();
  event.preventDefault();

  resetTimer();
  emit('click');
}

// Start progress when mounted
onMounted(() => {
  startProgress();
});

// Cleanup on unmount
onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
});

// Expose for parent control
defineExpose({ resetTimer });
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-9999 size-20 flex items-center justify-center">
      <!-- Progress ring -->
      <svg class="absolute inset-0 size-20 -rotate-90" viewBox="0 0 36 36">
        <!-- Background circle -->
        <circle
          cx="18"
          cy="18"
          r="16"
          stroke="rgba(255,255,255,0.25)"
          stroke-width="3"
          fill="none"
        />
        <!-- Progress circle -->
        <circle
          cx="18"
          cy="18"
          r="16"
          stroke="var(--ui-primary)"
          stroke-width="3"
          fill="none"
          stroke-linecap="round"
          :style="{
            strokeDasharray: 100,
            strokeDashoffset: progressPercent,
          }"
        />
      </svg>

      <!-- Combo button -->
      <UButton
        square
        class="rounded-full size-16 font-bold text-sm relative"
        @click="handleClick"
      >
        <div class="flex flex-col justify-center items-center w-full h-fit">
          <span class="text-lg leading-none">X{{ giftStore.comboCount }}</span>
          <span class="text-xs font-semibold leading-none">Combo</span>
        </div>
      </UButton>
    </div>
  </Teleport>
</template>
