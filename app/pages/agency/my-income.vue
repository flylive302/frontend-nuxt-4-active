<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, ref, computed } from 'vue'
import type { RunOption } from '~/types/income/income'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// State
// ========================================

const selectedOption = ref<RunOption | undefined>(undefined)

// ========================================
// Composables
// ========================================

const incomeStore = useIncomeStore()
const { fetchAll, fetchHistory, fetchSnapshot, claim } = useIncomeActions()
const agencyStore = useAgencyStore()
const { fetchUserAgency } = useAgencyMembership()

// ========================================
// Computed
// ========================================

const isAgencyMember = computed(() => agencyStore.isAgencyMember)
const snapshot = computed(() => incomeStore.selectedSnapshot)
const hasClaimable = computed(
  () => snapshot.value?.milestones.some((m) => !m.member_reward_claimed && m.member_diamond_reward > 0) ?? false
)

// ========================================
// Handlers
// ========================================

function onSelectRun(option: RunOption | undefined): void {
  if (option) fetchSnapshot(option.run_id)
  else incomeStore.setSelectedSnapshot(null)
}

function onClaim(): void {
  if (snapshot.value) claim(snapshot.value.id)
}

function formatRange(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  if (!agencyStore.isAgencyMember) {
    await fetchUserAgency()
  }

  if (agencyStore.isAgencyMember) {
    await Promise.all([fetchAll(), fetchHistory()])
  }
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile">My Agency Income</NavAlt>

    <!-- Not Agency Member -->
    <div v-if="!isAgencyMember" class="px-3 py-14 text-center">
      <UIcon name="i-lucide-building-2" class="size-16 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-2">Agency Members Only</h2>
      <p class="text-sm text-muted mb-4">
        You need to be a member of an agency to view your income.
      </p>
      <UButton to="/agency/list" color="primary">
        Browse Agencies
      </UButton>
    </div>

    <!-- Income Dashboard -->
    <div v-else class="px-3 py-14 space-y-6">
      <!-- Lifetime Summary -->
      <AgencyRecentEarnings />

      <!-- Active Run -->
      <section v-if="incomeStore.hasActiveRun">
        <SectionTitle type="tertiary">Current Run</SectionTitle>
        <AgencyIncomeTargetProgress class="mt-2" />

        <SectionTitle type="tertiary" class="mt-4">Milestone Ladder</SectionTitle>
        <AgencyIncomeLadderTable class="mt-2" />
      </section>

      <!-- No Active Run -->
      <div
        v-else-if="!incomeStore.isRunLoading"
        class="text-center py-6 bg-elevated rounded-lg"
      >
        <UIcon name="i-lucide-trending-up" class="size-10 text-muted mb-2" />
        <p class="text-sm text-muted">No active run</p>
      </div>

      <!-- History -->
      <section>
        <SectionTitle type="tertiary">Past Runs</SectionTitle>

        <USelectMenu
          v-model="selectedOption"
          :items="incomeStore.runOptions"
          :loading="incomeStore.isHistoryLoading"
          label-key="label"
          placeholder="Select a past run by date"
          icon="i-lucide-calendar"
          class="mt-2 w-full"
          @update:model-value="onSelectRun"
        />

        <!-- Snapshot -->
        <div v-if="incomeStore.isSnapshotLoading" class="mt-3 space-y-2">
          <USkeleton class="h-16 rounded-lg" />
          <USkeleton class="h-16 rounded-lg" />
        </div>

        <div v-else-if="snapshot" class="mt-3 space-y-3">
          <div class="bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg p-3">
            <div class="flex items-center justify-between">
              <UBadge :color="(snapshot.status_color as 'success' | 'info' | 'warning' | 'error' | 'neutral')" variant="soft" class="font-bold">
                {{ snapshot.status_label }}
              </UBadge>
              <span class="text-xs text-muted">
                {{ formatRange(snapshot.started_at) }} – {{ formatRange(snapshot.ends_at) }}
              </span>
            </div>
            <div class="flex justify-between text-sm mt-2 text-white">
              <span><UIcon name="i-lucide-zap" class="size-4" /> {{ formatCurrency(snapshot.accumulated_xp) }} XP</span>
              <span v-if="snapshot.refunded_coins > 0">
                <UIcon name="i-lucide-undo-2" class="size-4" /> {{ formatCurrency(snapshot.refunded_coins) }} refunded
              </span>
            </div>
          </div>

          <!-- Milestones -->
          <div
            v-for="milestone in snapshot.milestones"
            :key="milestone.tier"
            class="flex items-center justify-between bg-elevated rounded-lg p-3"
          >
            <div class="flex items-center gap-2">
              <UBadge color="success" variant="soft" class="font-bold">Tier {{ milestone.tier }}</UBadge>
              <span class="text-sm text-secondary font-semibold">
                <UIcon name="i-lucide-gem" class="size-4" /> {{ milestone.member_diamond_reward }}
              </span>
            </div>
            <UBadge :color="milestone.member_reward_claimed ? 'success' : 'warning'" variant="soft">
              {{ milestone.member_reward_claimed ? 'Claimed' : 'Unclaimed' }}
            </UBadge>
          </div>

          <p v-if="snapshot.milestones.length === 0" class="text-sm text-muted text-center py-2">
            No milestones crossed in this run.
          </p>

          <!-- Claim -->
          <UButton
            v-if="hasClaimable"
            block
            color="secondary"
            :loading="incomeStore.isClaiming"
            icon="i-lucide-gem"
            @click="onClaim"
          >
            Claim Rewards
          </UButton>
        </div>
      </section>

      <!-- Error State -->
      <UAlert
        v-if="incomeStore.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="incomeStore.error"
      />
    </div>
  </main>
</template>
