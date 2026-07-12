<script setup lang="ts">
// ========================================
// Kick Duration Popover (INTENT only)
// ========================================
// Wraps a trigger (the kick button) and shows the six canonical
// BlockDuration choices anchored above it. Selecting one is the ONLY way to
// kick — there is no duration-less kick (ADR 0017 / room-blocks PRD).

import { BLOCK_DURATIONS, type BlockDurationValue } from '~/constants/room'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  select: [duration: BlockDurationValue]
}>()

function handleSelect(duration: BlockDurationValue): void {
  open.value = false
  emit('select', duration)
}
</script>

<template>
  <UPopover v-model:open="open" :content="{ side: 'top', align: 'center', sideOffset: 8 }">
    <slot />

    <template #content>
      <div class="flex flex-col p-1 min-w-44">
        <UButton
          v-for="duration in BLOCK_DURATIONS"
          :key="duration.value"
          variant="ghost"
          color="neutral"
          block
          class="justify-start"
          @click="handleSelect(duration.value)"
        >
          {{ duration.label }}
        </UButton>
      </div>
    </template>
  </UPopover>
</template>
