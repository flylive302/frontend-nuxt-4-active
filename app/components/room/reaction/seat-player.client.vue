<script setup lang="ts">
/**
 * Seat Reaction Player — INTENT only. Renders one Lottie for a Seat
 * Reaction, swapped in place of the avatar. All lifecycle/playback-rule
 * logic lives in useSeatReactionPlayer (ADR 0015).
 */
import { useSeatReactionPlayer } from '~/composables/room/useSeatReactionPlayer';

const props = defineProps<{
  code: string;
}>();

const emit = defineEmits<{ done: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);

const { init, destroy } = useSeatReactionPlayer(canvas, {
  code: props.code,
  onDone: () => emit('done'),
});

onMounted(() => {
  init();
});

onBeforeUnmount(() => {
  destroy();
});
</script>

<template>
  <canvas ref="canvas" class="w-full h-full" />
</template>
