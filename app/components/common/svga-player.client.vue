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
  /**
   * Draw a dynamic element once its sprite slot size is known. Preferred over
   * `dynamicElements`, which the lib renders at natural size and clips when it
   * doesn't match the slot.
   */
  dynamicElementFactories?: Record<string, (width: number, height: number) => HTMLCanvasElement | null>;
  motionPause?: boolean;
}>(), {
  width: '100%',
  height: '100%',
  loop: 0,
  autoplay: true,
  motionPause: true,
  replaceElements: () => ({}),
  dynamicElements: () => ({}),
  dynamicElementFactories: undefined
});

const emit = defineEmits<{ complete: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const { reload } = useSvgaPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay'),
  motionPause: props.motionPause,
  onComplete: () => emit('complete'),
  replaceElements: props.replaceElements,
  dynamicElements: props.dynamicElements,
  dynamicElementFactories: props.dynamicElementFactories,
});

defineExpose({ reload });
</script>