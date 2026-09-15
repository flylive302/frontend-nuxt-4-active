<script setup lang="ts">
// ========================================
// Member Income — cycle-centric owner/admin page
// ========================================
// Route binding + load only. One overview call on mount, one summary call per
// cycle switch (cached for the visit). Access: owner or admin of the current
// managed agency; everyone else sees "Access Denied". The Owner hero renders
// only when the server sends the `owner` block (owner only, never admins).

import { onMounted, computed, ref } from 'vue'

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

const agencyStore = useAgencyStore()
const ownerIncomeStore = useOwnerIncomeStore()
const { loadOwnerIncomePage, selectCycle } = useOwnerIncomeActions()
const { fetchUserAgency } = useAgencyMembership()

const isAgencyResolved = ref(false)
const isOwnerOrAdmin = computed(() => agencyStore.isAgencyOwner || agencyStore.isAgencyAdmin)
const overview = computed(() => ownerIncomeStore.overview)
const summary = computed(() => ownerIncomeStore.selectedSummary)

const isFirstLoad = computed(
  () =>
    !isAgencyResolved.value ||
    (isOwnerOrAdmin.value && overview.value === null && ownerIncomeStore.overviewError === null)
)

function onSelectCycle(cycleNumber: number): void {
  void selectCycle(cycleNumber)
}

function onRetryCycle(): void {
  if (ownerIncomeStore.selectedCycle !== null) void selectCycle(ownerIncomeStore.selectedCycle)
}

function onRetryPage(): void {
  void loadOwnerIncomePage()
}

onMounted(async () => {
  if (!agencyStore.userAgency.agency) {
    await fetchUserAgency()
  }
  isAgencyResolved.value = true

  if (isOwnerOrAdmin.value) {
    await loadOwnerIncomePage()
  }
})
</script>

<template>
  <main>
    <NavAlt spacer color="primary" back-to="/agency/my-agency">Member Income</NavAlt>

    <!-- First load -->
    <div v-if="isFirstLoad" class="px-3 py-14 space-y-4">
      <USkeleton class="h-12 rounded-lg" />
      <USkeleton class="h-12 rounded-lg" />
      <AgencyIncomeCycleSummarySkeleton />
    </div>

    <!-- Not Authorized -->
    <div v-else-if="!isOwnerOrAdmin" class="px-3 py-14 text-center">
      <icon name="i-lucide-lock" class="size-16 text-muted mb-4" />
      <h2 class="text-lg font-semibold mb-2">Access Denied</h2>
      <p class="text-sm text-muted mb-4">
        Only agency owners and admins can view member income.
      </p>
      <UButton to="/agency/my-agency" color="primary">
        Go to My Agency
      </UButton>
    </div>

    <!-- Overview failed -->
    <div v-else-if="ownerIncomeStore.overviewError" class="px-3 py-14 space-y-4">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="ownerIncomeStore.overviewError"
      />
      <div class="flex justify-center">
        <UButton size="sm" variant="soft" icon="i-lucide-rotate-cw" @click="onRetryPage">Retry</UButton>
      </div>
    </div>

    <!-- Content for Owners/Admins -->
    <div v-else-if="overview" class="px-3 py-14 space-y-4">
      <AgencyIncomeManagedAgencyHeader :agency="overview.agency" />

      <!-- Agency never had a run -->
      <div v-if="!ownerIncomeStore.hasCycles" class="text-center py-8 bg-elevated rounded-lg">
        <UIcon name="i-lucide-trending-up" class="size-12 text-muted mb-2" />
        <p class="text-sm font-semibold">No runs yet</p>
        <p class="text-sm text-muted">Income shows here once a member starts a run.</p>
      </div>

      <template v-else>
        <AgencyIncomeCycleSelector
          :cycles="ownerIncomeStore.cycles"
          :model-value="ownerIncomeStore.selectedCycle"
          :loading="ownerIncomeStore.isOverviewLoading"
          @update:model-value="onSelectCycle"
        />

        <AgencyIncomeInProgressNote v-if="ownerIncomeStore.isSelectedCycleInProgress" />

        <!-- Selected cycle -->
        <section v-if="summary" class="space-y-4">
          <AgencyIncomeMembersHero :totals="summary.members" />
          <AgencyIncomeOwnerHero v-if="summary.owner" :totals="summary.owner" />
        </section>

        <div v-else-if="ownerIncomeStore.isSelectedCycleLoading" class="space-y-4">
          <AgencyIncomeCycleSummarySkeleton />
          <AgencyIncomeCycleSummarySkeleton v-if="agencyStore.isAgencyOwner" />
        </div>

        <div v-else-if="ownerIncomeStore.selectedCycle !== null" class="text-center py-6 bg-elevated rounded-lg">
          <p class="text-sm text-muted mb-2">Could not load this run.</p>
          <UButton size="sm" variant="soft" icon="i-lucide-rotate-cw" @click="onRetryCycle">Retry</UButton>
        </div>
      </template>
    </div>
  </main>
</template>
