<!-- ~/components/agency/income/MemberIncomeSheet.vue -->
<!-- Bottom sheet: one agency member's run for a cycle, on the owner/admin
     Member Income page. Presentational — all data comes from props; the
     caller owns opening, loading and retrying. The only local state is the
     view kept on screen while the drawer animates closed. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed, ref, watch } from 'vue'
import type { OwnerIncomeMemberSheet, OwnerIncomeSheetMember } from '~/types/income/ownerIncome'
import { formatRunRange, toStatusBadgeColor } from '~/utils/incomeFormat'
import { formatXp } from '~/utils/currency'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  open: boolean
  member: OwnerIncomeSheetMember | null
  sheet: OwnerIncomeMemberSheet | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()

// ========================================
// State
// ========================================

interface SheetView {
  member: OwnerIncomeSheetMember | null
  sheet: OwnerIncomeMemberSheet | null
  loading: boolean
  error: string | null
}

// The caller clears everything the moment the sheet closes; the view captured
// while it was open stays on screen as the drawer animates out, instead of the
// drawer going blank (or mixing two members' data).
const closingView = ref<SheetView>({ member: null, sheet: null, loading: false, error: null })

watch(
  () => [props.open, props.member, props.sheet, props.loading, props.error] as const,
  ([open, member, sheet, loading, error]) => {
    if (open) closingView.value = { member, sheet, loading, error }
  },
  { immediate: true }
)

// ========================================
// Computed
// ========================================

const shown = computed<SheetView>(() =>
  props.open
    ? { member: props.member, sheet: props.sheet, loading: props.loading, error: props.error }
    : closingView.value
)

const shownMember = computed(() => shown.value.member)
const shownSheet = computed(() => shown.value.sheet)

const drawerTitle = computed(() => shownMember.value?.name ?? 'Member income')

const fallbackInitial = computed(() => shownMember.value?.name.charAt(0).toUpperCase() ?? '?')

// ========================================
// Handlers
// ========================================

function onUpdateOpen(value: boolean): void {
  if (!value) emit('close')
}
</script>

<template>
  <UDrawer :open="open" :title="drawerTitle" description="Run income breakdown" @update:open="onUpdateOpen">
    <template #content>
      <div class="px-3 py-3 space-y-4 max-h-[85vh] overflow-y-auto">
        <!-- Member Header -->
        <div v-if="shownMember" class="flex items-center gap-2">
          <UAvatar :src="shownMember.avatar_url ?? undefined" :alt="shownMember.name" :text="fallbackInitial" size="sm" />
          <div class="min-w-0">
            <p class="text-sm font-semibold truncate flex items-center gap-1.5">
              <span class="truncate">{{ shownMember.name }}</span>
              <UBadge v-if="shownMember.left" color="warning" variant="subtle" size="sm">Left</UBadge>
            </p>
            <p v-if="shownMember.signature" class="text-xs text-muted truncate">#{{ shownMember.signature }}</p>
          </div>
        </div>

        <!-- Loaded Sheet -->
        <template v-if="shownSheet">
          <div class="flex items-center justify-between gap-2">
            <p class="text-xs text-muted">{{ formatRunRange(shownSheet.run.started_at, shownSheet.run.ends_at) }}</p>
            <UBadge :color="toStatusBadgeColor(shownSheet.run.status_color)" variant="soft" class="font-bold shrink-0">
              {{ shownSheet.run.status_label }}
            </UBadge>
          </div>
          <p class="text-xs text-muted">
            T{{ shownSheet.run.current_tier }} · {{ formatXp(shownSheet.run.accumulated_xp) }} Gift coins
          </p>

          <AgencyIncomeHero :totals="shownSheet.totals" />
          <AgencyIncomeTotalsCards
            :key="shownSheet.run.id"
            :totals="shownSheet.totals"
            :exchanges="shownSheet.exchanges"
            :deductions="shownSheet.deductions"
          />

          <div>
            <p class="text-xs uppercase tracking-wide text-muted font-semibold mb-2">Milestones</p>
            <AgencyIncomeMilestoneRows :milestones="shownSheet.milestones" />
          </div>
        </template>

        <!-- Loading -->
        <div v-else-if="shown.loading" class="space-y-4">
          <div class="py-4 space-y-2 flex flex-col items-center">
            <USkeleton class="h-3 w-16 rounded" />
            <USkeleton class="h-10 w-40 rounded" />
            <USkeleton class="h-3 w-48 rounded" />
          </div>
          <div class="space-y-2">
            <USkeleton class="h-14 rounded-lg" />
            <USkeleton class="h-14 rounded-lg" />
            <USkeleton class="h-14 rounded-lg" />
          </div>
          <div class="space-y-2">
            <USkeleton class="h-12 rounded-lg" />
            <USkeleton class="h-12 rounded-lg" />
            <USkeleton class="h-12 rounded-lg" />
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="shown.error" class="text-center py-6 bg-elevated rounded-lg space-y-1">
          <p class="text-sm text-muted">Could not load this member's run.</p>
          <p class="text-xs text-muted">{{ shown.error }}</p>
          <UButton size="sm" variant="soft" icon="i-lucide-rotate-cw" @click="emit('retry')">Retry</UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>
