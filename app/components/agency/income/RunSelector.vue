<!-- ~/components/agency/income/RunSelector.vue -->
<!-- Trigger button + mobile sheet for picking a run out of the overview's
     grouped run list (grouped by agency, newest run first per group). -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed, ref } from 'vue'
import type { OverviewAgencyGroup, OverviewRun } from '~/types/income/income'
import { toStatusBadgeColor } from '~/utils/incomeFormat'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  groups: OverviewAgencyGroup[]
  modelValue: number | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [runId: number]
}>()

// ========================================
// State
// ========================================

const open = ref(false)

// ========================================
// Computed
// ========================================

const selectedRun = computed<OverviewRun | null>(() => {
  for (const group of props.groups) {
    const found = group.runs.find((run) => run.id === props.modelValue)
    if (found) return found
  }
  return null
})

// ========================================
// Handlers
// ========================================

function selectRun(runId: number): void {
  emit('update:modelValue', runId)
  open.value = false
}

function openSelector(): void {
  open.value = true
}
</script>

<template>
  <!-- Loading State -->
  <USkeleton v-if="loading" class="h-12 w-full rounded-lg" />

  <template v-else-if="groups.length > 0">
    <UButton
      color="neutral"
      variant="soft"
      block
      class="justify-between"
      trailing-icon="i-lucide-chevron-down"
      @click="openSelector"
    >
      <span class="flex items-center gap-2 truncate">
        <span class="truncate">{{ selectedRun?.label ?? 'Select a run' }}</span>
        <UBadge
          v-if="selectedRun"
          :color="toStatusBadgeColor(selectedRun.status_color)"
          variant="soft"
          size="sm"
        >
          {{ selectedRun.status_label }}
        </UBadge>
      </span>
    </UButton>

    <UDrawer v-model:open="open" title="Select a Run" description="Pick a run to view its income breakdown.">
      <template #content>
        <div class="px-3 py-3 space-y-4 max-h-[80vh] overflow-y-auto">
          <div v-for="group in groups" :key="group.id" class="space-y-2">
            <div class="flex items-center gap-2">
              <UAvatar
                :src="group.logo_url ?? undefined"
                :alt="group.name"
                icon="i-lucide-building-2"
                size="xs"
              />
              <span class="text-xs font-semibold text-muted">#{{ group.id }} · {{ group.name }}</span>
            </div>

            <button
              v-for="run in group.runs"
              :key="run.id"
              type="button"
              class="w-full flex items-center justify-between gap-2 rounded-lg p-3 text-left bg-elevated/60"
              :class="{ 'ring-2 ring-primary': run.id === modelValue }"
              @click="selectRun(run.id)"
            >
              <span class="text-sm font-medium truncate">{{ run.label }}</span>
              <span class="flex items-center gap-1 shrink-0">
                <UBadge v-if="run.has_unclaimed" color="warning" variant="soft" size="sm">Unclaimed</UBadge>
                <UBadge :color="toStatusBadgeColor(run.status_color)" variant="soft" size="sm">
                  {{ run.status_label }}
                </UBadge>
              </span>
            </button>
          </div>
        </div>
      </template>
    </UDrawer>
  </template>
</template>
