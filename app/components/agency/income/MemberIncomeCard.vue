<!-- ~/components/agency/income/MemberIncomeCard.vue -->
<!-- One roster row: avatar/name/signature, income figure, earned/exchanged/
     deducted breakdown, then tier + XP (or "No run" when the member has no
     run this cycle). A row with a run is a button that emits `open` (member
     sheet); a row with no run is not tappable. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed } from 'vue'
import type { OwnerIncomeMemberRow } from '~/types/income/ownerIncome'
import { formatDiamondsExact } from '~/utils/incomeFormat'
import { formatXp } from '~/utils/currency'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  member: OwnerIncomeMemberRow
}>()

const emit = defineEmits<{
  open: [member: OwnerIncomeMemberRow]
}>()

// ========================================
// Computed
// ========================================

const fallbackInitial = computed(() => props.member.name.charAt(0).toUpperCase())
const isTappable = computed(() => props.member.run_id !== null)

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
      <template v-if="member.run_id === null">No run</template>
      <template v-else>T{{ member.current_tier }} · {{ formatXp(member.accumulated_xp) }} XP</template>
    </p>
  </component>
</template>
