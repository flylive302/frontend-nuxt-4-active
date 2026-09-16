<!-- ~/components/agency/income/CycleSelector.vue -->
<!-- Trigger button + mobile sheet for picking a reporting window: either a
     global cycle (Run N) out of the owner/admin overview's cycle list
     (newest first, never re-sorted), or — when ranges are enabled — a custom
     UTC date range. Auto-imported as AgencyIncomeCycleSelector. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed, ref, watch } from 'vue'
import type {
  OwnerIncomeCycle,
  OwnerIncomeRangeLimits,
  OwnerIncomeWindowSelection,
} from '~/types/income/ownerIncome'
import { checkOwnerIncomeRange, defaultOwnerIncomeRange, ownerIncomeDayLabel } from '~/utils/ownerIncomeWindow'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  cycles: OwnerIncomeCycle[]
  selection: OwnerIncomeWindowSelection | null
  label: string | null
  inProgress: boolean
  loading: boolean
  rangesEnabled: boolean
  rangeLimits: OwnerIncomeRangeLimits | null
}>()

const emit = defineEmits<{
  select: [selection: OwnerIncomeWindowSelection]
}>()

// ========================================
// State
// ========================================

const open = ref(false)
const showRangePicker = ref(false)
const from = ref('')
const to = ref('')

// ========================================
// Computed
// ========================================

const showCustomDatesEntry = computed(() => props.rangesEnabled && props.rangeLimits !== null)

const isRangeSelected = computed(() => props.selection?.kind === 'range')

const rangeCheck = computed(() => checkOwnerIncomeRange(from.value, to.value, props.rangeLimits))

const rangeErrorMessage = computed(() => (rangeCheck.value.valid ? null : rangeCheck.value.message))

const canApplyRange = computed(() => rangeCheck.value.valid)

const limitsHelpText = computed(() => {
  const limits = props.rangeLimits
  if (limits === null) return null
  return `Up to ${limits.max_span_days} days, from ${ownerIncomeDayLabel(limits.min_day)} to ${ownerIncomeDayLabel(limits.max_day)}`
})

// ========================================
// Handlers
// ========================================

function seedRangeInputs(): void {
  if (props.selection?.kind === 'range') {
    from.value = props.selection.from
    to.value = props.selection.to
    return
  }

  // A fresh picker opens on a range that already passes the bounds check —
  // seeding the full min_day…max_day span would exceed max_span_days and
  // disable Apply before the owner has touched anything.
  const fallback = defaultOwnerIncomeRange(props.rangeLimits)
  from.value = fallback.from
  to.value = fallback.to
}

function openSelector(): void {
  showRangePicker.value = false
  open.value = true
}

function selectCycle(cycleNumber: number): void {
  emit('select', { kind: 'run', number: cycleNumber })
  open.value = false
}

function openCustomDates(): void {
  seedRangeInputs()
  showRangePicker.value = true
}

function backToList(): void {
  showRangePicker.value = false
}

function applyRange(): void {
  if (!canApplyRange.value) return
  emit('select', { kind: 'range', from: from.value, to: to.value })
  open.value = false
  showRangePicker.value = false
}

watch(open, (value) => {
  if (!value) showRangePicker.value = false
})
</script>

<template>
  <!-- Loading State -->
  <USkeleton v-if="loading" class="h-12 w-full rounded-lg" />

  <template v-else-if="cycles.length > 0 || showCustomDatesEntry">
    <UButton
      color="neutral"
      variant="soft"
      block
      class="justify-between"
      trailing-icon="i-lucide-chevron-down"
      @click="openSelector"
    >
      <span class="flex items-center gap-2 truncate">
        <span class="truncate">{{ label ?? 'Select a run' }}</span>
        <UBadge v-if="label !== null" :color="inProgress ? 'info' : 'neutral'" variant="soft" size="sm">
          {{ inProgress ? 'In progress' : 'Closed' }}
        </UBadge>
      </span>
    </UButton>

    <UDrawer
      v-model:open="open"
      :title="showRangePicker ? 'Custom dates' : 'Select a Run'"
      :description="showRangePicker ? 'Pick the dates to report on.' : 'Pick a run to see what your agency earned in it.'"
    >
      <template #content>
        <div class="px-3 py-3 space-y-2 max-h-[80vh] overflow-y-auto">
          <!-- Run list + Custom dates entry -->
          <template v-if="!showRangePicker">
            <button
              v-if="showCustomDatesEntry"
              type="button"
              class="w-full flex items-center gap-2 rounded-lg p-3 text-left bg-elevated/60"
              :class="{ 'ring-2 ring-primary': isRangeSelected }"
              @click="openCustomDates"
            >
              <UIcon name="i-lucide-calendar-range" class="size-4 shrink-0" />
              <span class="text-sm font-medium truncate">Custom dates</span>
            </button>

            <button
              v-for="cycle in cycles"
              :key="cycle.number"
              type="button"
              class="w-full flex items-center justify-between gap-2 rounded-lg p-3 text-left bg-elevated/60"
              :class="{ 'ring-2 ring-primary': selection?.kind === 'run' && cycle.number === selection.number }"
              @click="selectCycle(cycle.number)"
            >
              <span class="text-sm font-medium truncate">{{ cycle.label }}</span>
              <UBadge :color="cycle.in_progress ? 'info' : 'neutral'" variant="soft" size="sm" class="shrink-0">
                {{ cycle.in_progress ? 'In progress' : 'Closed' }}
              </UBadge>
            </button>
          </template>

          <!-- Custom date range picker -->
          <div v-else class="space-y-3">
            <button type="button" class="text-xs text-muted flex items-center gap-1" @click="backToList">
              <UIcon name="i-lucide-chevron-left" class="size-3.5" />
              Back to runs
            </button>

            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-xs text-muted" for="owner-income-range-from">From</label>
                <UInput
                  id="owner-income-range-from"
                  v-model="from"
                  type="date"
                  :min="rangeLimits?.min_day"
                  :max="rangeLimits?.max_day"
                  class="w-full"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs text-muted" for="owner-income-range-to">To</label>
                <UInput
                  id="owner-income-range-to"
                  v-model="to"
                  type="date"
                  :min="rangeLimits?.min_day"
                  :max="rangeLimits?.max_day"
                  class="w-full"
                />
              </div>
            </div>

            <p v-if="limitsHelpText" class="text-xs text-muted">{{ limitsHelpText }}</p>
            <p v-if="rangeErrorMessage" class="text-xs text-error">{{ rangeErrorMessage }}</p>

            <UButton block :disabled="!canApplyRange" @click="applyRange">Apply</UButton>
          </div>
        </div>
      </template>
    </UDrawer>
  </template>
</template>
