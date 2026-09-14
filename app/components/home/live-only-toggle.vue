<script setup lang="ts">
defineProps<{
  /** `true` = show only rooms that are live with at least one participant */
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()
</script>

<template>
  <button
    class="shrink-0 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-colors duration-200 text-white"
    :class="modelValue
      ? 'bg-rose-500'
      : 'bg-white/15 ring-1 ring-white/25'"
    :aria-pressed="modelValue"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="size-2 rounded-full" :class="modelValue ? 'bg-white animate-pulse' : 'bg-white/50'" />
    {{ modelValue ? 'Live' : 'All' }}
  </button>
</template>
