<!-- ~/components/agency/income/MemberIncomeSheet.vue -->
<!-- Bottom sheet: one agency member's figures for the open window, on the
     owner/admin Member Income page. Run mode shows a run header and reads Gift
     coins off the run; range mode has no single run (`sheet.run` is null) and
     reads them off `totals`. Presentational — all data comes from props; the
     caller owns opening, loading and retrying, and passes `viewKey` so the
     collapsible totals reset between members. The only local state is the view
     kept on screen while the drawer animates closed. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed, ref, watch } from 'vue'
import type { OwnerIncomeMemberSheet, OwnerIncomeSheetMember, OwnerIncomeWindowKind } from '~/types/income/ownerIncome'
import { formatRunRange, toStatusBadgeColor } from '~/utils/incomeFormat'
import { formatXp } from '~/utils/currency'
import { ownerIncomeSheetGiftCoins } from '~/utils/ownerIncomeCard'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  open: boolean
  member: OwnerIncomeSheetMember | null
  sheet: OwnerIncomeMemberSheet | null
  loading: boolean
  error: string | null
  windowKind: OwnerIncomeWindowKind
  viewKey: string
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

const drawerDescription = computed(() =>
  props.windowKind === 'range' ? 'Income breakdown for the selected dates' : 'Run income breakdown'
)

const errorCopy = computed(() =>
  props.windowKind === 'range' ? "Could not load this member's income." : "Could not load this member's run."
)

const giftCoins = computed(() =>
  ownerIncomeSheetGiftCoins(
    props.windowKind,
    shownSheet.value?.run?.accumulated_xp ?? null,
    shownSheet.value?.totals.gift_coins
  )
)

// ========================================
// Handlers
// ========================================

function onUpdateOpen(value: boolean): void {
  if (!value) emit('close')
}
</script>

<template>
  <UDrawer :open="open" :title="drawerTitle" :description="drawerDescription" @update:open="onUpdateOpen">
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
          <template v-if="shownSheet.run">
            <div class="flex items-center justify-between gap-2">
              <p class="text-xs text-muted">{{ formatRunRange(shownSheet.run.started_at, shownSheet.run.ends_at) }}</p>
              <UBadge :color="toStatusBadgeColor(shownSheet.run.status_color)" variant="soft" class="font-bold shrink-0">
                {{ shownSheet.run.status_label }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              T{{ shownSheet.run.current_tier }} · {{ formatXp(giftCoins) }} Gift coins
            </p>
          </template>
          <p v-else class="text-xs text-muted">{{ formatXp(giftCoins) }} Gift coins</p>

          <AgencyIncomeHero :totals="shownSheet.totals" />
          <AgencyIncomeTotalsCards
            :key="viewKey"
            :totals="shownSheet.totals"
            :exchanges="shownSheet.exchanges"
            :deductions="shownSheet.deductions"
          />

          <p class="text-xs text-muted">Deducted counts reseller payouts made one run later.</p>

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
          <p class="text-sm text-muted">{{ errorCopy }}</p>
          <p class="text-xs text-muted">{{ shown.error }}</p>
          <UButton size="sm" variant="soft" icon="i-lucide-rotate-cw" @click="emit('retry')">Retry</UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>
