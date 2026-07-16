<template>
  <canvas ref="canvas" class="m-0 p-0" :style="{ width, height }" />
</template>

<script setup lang="ts">
/**
 * VAP Player Component
 *
 * Plays MP4 videos with alpha transparency using WebGL compositing.
 * Drop-in usage mirroring svga-player.client.vue.
 *
 * Usage:
 *   <VapPlayer name="/vip/car.mp4" />
 *   <!-- Loads /vip/car.mp4 + /vip/car.json -->
 */
import { ref, toRef } from 'vue'
import { useVapPlayer } from '~/composables/vap/useVapPlayer'

const props = withDefaults(defineProps<{
  /** Video URL — can include .mp4 extension, .json is derived automatically */
  name: string
  width?: string
  height?: string
  /** Loop count (0 = infinite, 1 = play once) */
  loop?: number
  autoplay?: boolean
  /** Mute audio. Default: true (needed for autoplay). Set false for audio. */
  muted?: boolean
}>(), {
  width: '100%',
  height: '100%',
  loop: 0,
  autoplay: true,
  muted: true,
})

const emit = defineEmits<{
  complete: []
  /** Heartbeat while playback advances — feeds the queue's stall detector */
  progress: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

const { reload, restart, isPlaying } = useVapPlayer(canvas, {
  name: toRef(props, 'name'),
  loop: toRef(props, 'loop'),
  autoplay: toRef(props, 'autoplay'),
  muted: toRef(props, 'muted'),
  onComplete: () => {
    emit('complete')
  },
  onProcess: () => {
    emit('progress')
  },
})

defineExpose({ reload, restart, isPlaying })
</script>
