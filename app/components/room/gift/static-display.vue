<script setup lang="ts">
/**
 * Gift Static Display
 *
 * Displays static image gifts for a configurable duration.
 */
import { STATIC_DISPLAY_DURATION_MS } from '~/constants/gift';

const props = withDefaults(
  defineProps<{
    src: string;
    durationMs?: number;
  }>(),
  {
    durationMs: STATIC_DISPLAY_DURATION_MS,
  }
);

const emit = defineEmits<{
  timeout: [];
}>();

let timeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Restart the display timer (for combo mode)
 */
function restart() {
  clearTimer();
  startTimer();
}

function startTimer() {
  timeoutId = setTimeout(() => {
    emit('timeout');
  }, props.durationMs);
}

function clearTimer() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

onMounted(() => {
  startTimer();
});

onBeforeUnmount(() => {
  clearTimer();
});

// Expose restart for combo mode
defineExpose({ restart });
</script>

<template>
  <div class="w-full h-full flex items-center justify-center">
    <NuxtImg :src="src" class="max-w-full max-h-full object-contain" />
  </div>
</template>
