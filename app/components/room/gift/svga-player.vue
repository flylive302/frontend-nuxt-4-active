<script setup lang="ts">
/**
 * Gift SVGA Player
 *
 * Plays SVGA animation gift assets with completion callback.
 */
import { useSvgaPlayer } from '~/composables/useSvgaPlayer';

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
}>();

const canvas = ref<HTMLCanvasElement | null>(null);

const { restart, isPlaying } = useSvgaPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay'),
  onComplete: () => {
    console.log(toRef(props, 'loop'));
    emit('complete');
  },
});

// Expose restart method for combo mode
defineExpose({ restart, isPlaying });
</script>

<template>
  <canvas ref="canvas" class="w-full h-full" />
</template>
