<!-- ~/components/agency/income/CycleSelector.vue -->
<!-- Trigger button + mobile sheet for picking a global cycle (Run N) out of
     the owner/admin overview's cycle list, newest first (never re-sorted —
     the order the list arrives in is the order shown). -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed, ref } from 'vue'
import type { OwnerIncomeCycle } from '~/types/income/ownerIncome'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  cycles: OwnerIncomeCycle[]
  modelValue: number | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [cycleNumber: number]
}>()

// ========================================
// State
// ========================================

const open = ref(false)

// ========================================
// Computed
// ========================================

const selectedCycle = computed<OwnerIncomeCycle | null>(
  () => props.cycles.find((cycle) => cycle.number === props.modelValue) ?? null
)

// ========================================
// Handlers
// ========================================

function selectCycle(cycleNumber: number): void {
  emit('update:modelValue', cycleNumber)
  open.value = false
}

function openSelector(): void {
  open.value = true
}
</script>

<template>
  <!-- Loading State -->
  <USkeleton v-if="loading" class="h-12 w-full rounded-lg" />

  <template v-else-if="cycles.length > 0">
    <UButton
      color="neutral"
      variant="soft"
      block
      class="justify-between"
      trailing-icon="i-lucide-chevron-down"
      @click="openSelector"
    >
      <span class="flex items-center gap-2 truncate">
        <span class="truncate">{{ selectedCycle?.label ?? 'Select a run' }}</span>
        <UBadge
          v-if="selectedCycle"
          :color="selectedCycle.in_progress ? 'info' : 'neutral'"
          variant="soft"
          size="sm"
        >
          {{ selectedCycle.in_progress ? 'In progress' : 'Closed' }}
        </UBadge>
      </span>
    </UButton>

    <UDrawer v-model:open="open" title="Select a Run" description="Pick a run to see what your agency earned in it.">
      <template #content>
        <div class="px-3 py-3 space-y-2 max-h-[80vh] overflow-y-auto">
          <button
            v-for="cycle in cycles"
            :key="cycle.number"
            type="button"
            class="w-full flex items-center justify-between gap-2 rounded-lg p-3 text-left bg-elevated/60"
            :class="{ 'ring-2 ring-primary': cycle.number === modelValue }"
            @click="selectCycle(cycle.number)"
          >
            <span class="text-sm font-medium truncate">{{ cycle.label }}</span>
            <UBadge :color="cycle.in_progress ? 'info' : 'neutral'" variant="soft" size="sm" class="shrink-0">
              {{ cycle.in_progress ? 'In progress' : 'Closed' }}
            </UBadge>
          </button>
        </div>
      </template>
    </UDrawer>
  </template>
</template>
