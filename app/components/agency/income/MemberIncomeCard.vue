<!-- ~/components/agency/income/MemberIncomeCard.vue -->
<!-- One roster row: avatar/name/signature, income figure, earned/exchanged/
     deducted breakdown, then Gift coins. In run mode the line is prefixed with
     the tier, or "No run" when the member has no run this cycle, and only a
     row with a run is tappable. In range mode there is no single run, so no
     tier is shown and every row opens its sheet. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed } from 'vue'
import type { OwnerIncomeMemberRow, OwnerIncomeWindowKind } from '~/types/income/ownerIncome'
import { formatDiamondsExact } from '~/utils/incomeFormat'
import { formatXp } from '~/utils/currency'
import { isOwnerIncomeMemberTappable } from '~/utils/ownerIncomeCard'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  member: OwnerIncomeMemberRow
  windowKind: OwnerIncomeWindowKind
}>()

const emit = defineEmits<{
  open: [member: OwnerIncomeMemberRow]
}>()

// ========================================
// Computed
// ========================================

const fallbackInitial = computed(() => props.member.name.charAt(0).toUpperCase())
const isTappable = computed(() => isOwnerIncomeMemberTappable(props.windowKind, props.member.run_id))

// ========================================
// Handlers
// ========================================

function onTap(): void {
  if (isTappable.value) emit('open', props.member)
}
</script>

<template>
  <component
    :is="isTappable ? 'button' : 'div'"
    :type="isTappable ? 'button' : undefined"
    class="block w-full text-left bg-elevated rounded-lg p-3 space-y-2"
    :class="{ 'cursor-pointer transition-colors active:bg-accented': isTappable }"
    @click="onTap"
  >
    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <UAvatar :src="member.avatar_url ?? undefined" :alt="member.name" :text="fallbackInitial" size="sm" />
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate flex items-center gap-1.5">
            <span class="truncate">{{ member.name }}</span>
            <UBadge v-if="member.left" color="warning" variant="subtle" size="sm">Left</UBadge>
          </p>
          <p v-if="member.signature" class="text-xs text-muted truncate">#{{ member.signature }}</p>
        </div>
      </div>

      <div class="text-right shrink-0">
        <p class="text-xs text-muted">Income</p>
        <p
          class="flex items-center gap-1 font-bold justify-end"
          :class="{ 'text-error': member.income < 0 }"
        >
          <UIcon name="i-lucide-gem" class="size-4" />
          {{ formatDiamondsExact(member.income) }}
        </p>
      </div>
    </div>

    <p class="text-xs text-muted">
      Earned {{ formatDiamondsExact(member.earned) }} · Exch {{ formatDiamondsExact(member.exchanged) }} · Ded
      {{ formatDiamondsExact(member.deducted) }}
    </p>

    <p class="text-xs text-muted">
      <template v-if="windowKind === 'run' && member.run_id === null">No run · </template>
      <template v-else-if="windowKind === 'run'">T{{ member.current_tier }} · </template>
      {{ formatXp(member.gift_coins) }} Gift coins
    </p>
  </component>
</template>
