<template>
  <canvas ref="canvas" :style="{ width, height }" />
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string;
  width?: string;
  height?: string;
  loop?: number;
  autoplay?: boolean;
}>(), {
  width: '100%',
  height: '100%',
  loop: 0,
  autoplay: true
});

const canvas = ref<HTMLCanvasElement | null>(null);
const { reload } = useSvgaPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay')
});

defineExpose({ reload });
</script>