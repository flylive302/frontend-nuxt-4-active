<template>
  <canvas ref="canvas" class="m-0 p-0" :style="{ width, height }" />
</template>

<script setup lang="ts">
import { ref, toRef } from "vue";
import { useSvgaPlayer } from '~/composables/gift/useSvgaPlayer';

const props = withDefaults(defineProps<{
  name: string;
  width?: string;
  height?: string;
  loop?: number;
  autoplay?: boolean;
  replaceElements?: Record<string, HTMLImageElement>;
  dynamicElements?: Record<string, HTMLCanvasElement>;
}>(), {
  width: '100%',
  height: '100%',
  loop: 0,
  autoplay: true
});

const emit = defineEmits<{ complete: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const { reload } = useSvgaPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay'),
  onComplete: () => emit('complete'),
  replaceElements: props.replaceElements,
  dynamicElements: props.dynamicElements,
});

defineExpose({ reload });
</script>