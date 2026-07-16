<script setup lang="ts">
/**
 * Gift VAP Player
 *
 * Plays VAP (MP4 + alpha via WebGL) gift assets with completion callback.
 */

const props = defineProps<{
  name: string
}>()

const emit = defineEmits<{
  complete: []
  /** Heartbeat while playback advances — feeds the queue's stall detector */
  progress: []
}>()

const vapRef = ref<{ restart: () => void; isPlaying: boolean } | null>(null)

function restart(): void {
  vapRef.value?.restart()
}

const isPlaying = computed(() => vapRef.value?.isPlaying ?? false)

defineExpose({ restart, isPlaying })
</script>

<template>
  <VapPlayer
    ref="vapRef"
    :name="props.name"
    :loop="1"
    :muted="true"
    class="w-full h-full"
    @complete="emit('complete')"
    @progress="emit('progress')"
  />
</template>
