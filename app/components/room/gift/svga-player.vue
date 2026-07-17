<script setup lang="ts">
/**
 * Gift SVGA Player
 *
 * Plays SVGA animation gift assets with completion callback.
 */
import { useSvgaPlayer } from '~/composables/gift/useSvgaPlayer';

const props = withDefaults(
  defineProps<{
    name: string;
    autoplay?: boolean;
    loop?: number;
  }>(),
  {
    autoplay: true,
    loop: 1, // Play once by default
  }
);

const emit = defineEmits<{
  complete: [];
  /** Heartbeat while playback advances — feeds the queue's stall detector */
  progress: [];
}>();

const canvas = ref<HTMLCanvasElement | null>(null);

const { restart, isPlaying } = useSvgaPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay'),
  onComplete: () => {
    emit('complete');
  },
  onProcess: () => {
    emit('progress');
  },
  // One-shot playback whose `complete` gates the gift queue — must never be
  // frozen by the global motion-pause (room-battery-perf/03).
  motionPause: false,
});

// Expose restart method for combo mode
defineExpose({ restart, isPlaying });
</script>

<template>
  <canvas ref="canvas" class="w-full h-full" />
</template>
