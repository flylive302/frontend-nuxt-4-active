<script setup lang="ts">
// ========================================
// My Agency Income — run-centric
// ========================================
// Route binding + load only. One overview call on mount, one detail call per
// run switch (cached for the visit). Access: current agency member OR has at
// least one run; everyone else sees "Agency Members Only".

import { onMounted, computed, ref } from 'vue'

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

const incomeStore = useIncomeStore()
const { loadIncomePage, selectRun, claim } = useIncomeActions()
const agencyStore = useAgencyStore()
const { fetchUserAgency } = useAgencyMembership()
const { currentModal: milestoneModal, drain: drainMilestones, closeModal: closeMilestoneModal } = useMilestoneDrain()

const isLoaded = ref(false)
const isAgencyMember = computed(() => agencyStore.isAgencyMember)
const canViewIncome = computed(() => isAgencyMember.value || incomeStore.hasAnyRun)
const overview = computed(() => incomeStore.overview)
const run = computed(() => incomeStore.selectedRunDetail)
const hasClaimable = computed(
  () => run.value?.milestones.some((m) => !m.member_reward_claimed && m.member_diamond_reward > 0) ?? false
)

function onSelectRun(runId: number): void {
  void selectRun(runId)
}

function onRetryRun(): void {
  if (incomeStore.selectedRunId !== null) void selectRun(incomeStore.selectedRunId)
}

function onClaim(): void {
  if (run.value) void claim(run.value.id)
}

onMounted(async () => {
  await Promise.all([
    agencyStore.isAgencyMember ? Promise.resolve() : fetchUserAgency(),
    loadIncomePage(),
  ])
  isLoaded.value = true

  // Page-gated: celebrate any tiers crossed since this device's last visit,
  // now that the active run (and its current_tier) is loaded.
  drainMilestones()
})
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile">My Agency Income</NavAlt>

    <!-- First load -->
    <div v-if="!isLoaded" class="px-3 py-14 space-y-4">
      <USkeleton class="h-20 rounded-lg" />
      <USkeleton class="h-10 rounded-lg" />
      <AgencyIncomeRunViewSkeleton />
    </div>

    <!-- Never a member, no runs -->
    <div v-else-if="!canViewIncome" class="px-3 py-14 text-center">
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
    <div v-else class="px-3 py-14 space-y-4">
      <AgencyIncomeLifetimeStrip
        :lifetime="overview?.lifetime ?? null"
        :current-agency="overview?.current_agency ?? null"
        :loading="incomeStore.isOverviewLoading && !overview"
      />

      <!-- Ex-member: past runs stay visible -->
      <div
        v-if="!isAgencyMember"
        class="flex items-center justify-between gap-3 bg-elevated rounded-lg p-3"
      >
        <p class="text-sm text-muted">Join an agency to start a new run.</p>
        <UButton to="/agency/list" size="sm" color="primary">Browse</UButton>
      </div>

      <AgencyIncomeUnclaimedBanner :count="overview?.unclaimed_runs_count ?? 0" />

      <!-- Member with no active run -->
      <div
        v-if="isAgencyMember && overview && overview.active_run_id === null"
        class="text-center py-4 bg-elevated rounded-lg"
      >
        <UIcon name="i-lucide-trending-up" class="size-8 text-muted mb-1" />
        <p class="text-sm text-muted">No active run — your next gift starts one.</p>
      </div>

      <template v-if="incomeStore.hasAnyRun">
        <AgencyIncomeRunSelector
          :groups="overview?.agencies ?? []"
          :model-value="incomeStore.selectedRunId"
          :loading="incomeStore.isOverviewLoading && !overview"
          @update:model-value="onSelectRun"
        />

        <AgencyIncomeInProgressNote v-if="incomeStore.isSelectedRunActive" />

        <!-- Selected run -->
        <AgencyIncomeRunViewSkeleton v-if="incomeStore.isSelectedRunLoading" />

        <section v-else-if="run" class="space-y-4">
          <AgencyIncomeRunHeader :run="run" />
          <AgencyIncomeHero :totals="run.totals" />
          <AgencyIncomeTotalsCards
            :totals="run.totals"
            :exchanges="run.exchanges"
            :deductions="run.deductions"
          />

          <template v-if="incomeStore.isSelectedRunActive">
            <SectionTitle type="tertiary">Current Run</SectionTitle>
            <AgencyIncomeTargetProgress />

            <SectionTitle type="tertiary">Milestone Ladder</SectionTitle>
            <AgencyIncomeLadderTable />
          </template>

          <SectionTitle type="tertiary">Milestones</SectionTitle>
          <AgencyIncomeMilestoneRows :milestones="run.milestones" />

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
        </section>

        <div v-else-if="incomeStore.selectedRunId !== null" class="text-center py-6 bg-elevated rounded-lg">
          <p class="text-sm text-muted mb-2">Could not load this run.</p>
          <UButton size="sm" variant="soft" icon="i-lucide-rotate-cw" @click="onRetryRun">Retry</UButton>
        </div>
      </template>

      <!-- Error State -->
      <UAlert
        v-if="incomeStore.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="incomeStore.error"
      />
    </div>

    <!-- Page-gated agency-milestone celebration -->
    <EventsIncomeTargetModal
      :open="milestoneModal !== null"
      :modal="milestoneModal"
      @close="closeMilestoneModal"
    />
  </main>
</template>
