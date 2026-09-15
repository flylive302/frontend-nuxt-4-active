<script setup lang="ts">
// ========================================
// Member Income — cycle-centric owner/admin page
// ========================================
// Route binding + load only. One overview call on mount; per cycle switch one
// summary call (cached for the visit) plus the members list page 1 (sort,
// search and paging run on the server via the actions composable). Tapping a
// member with a run opens their sheet over the list (the list stays mounted,
// so its scroll position is kept). Access: owner or admin of the current
// managed agency; everyone else sees "Access Denied". The Owner hero renders
// only when the server sends the `owner` block (owner only, never admins).

import { onBeforeUnmount, onMounted, computed, ref } from 'vue'
import type {
  OwnerIncomeMemberRow,
  OwnerIncomeMemberSort,
  OwnerIncomeSortDirection,
} from '~/types/income/ownerIncome'

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

const agencyStore = useAgencyStore()
const ownerIncomeStore = useOwnerIncomeStore()
const {
  loadOwnerIncomePage,
  selectCycle,
  loadMoreMembers,
  retryMembers,
  setMembersSort,
  setMembersDirection,
  setMembersSearch,
  cancelPendingSearch,
  openMember,
  closeMember,
  retryMemberSheet,
} = useOwnerIncomeActions()
const { fetchUserAgency } = useAgencyMembership()

const isAgencyResolved = ref(false)
const isOwnerOrAdmin = computed(() => agencyStore.isAgencyOwner || agencyStore.isAgencyAdmin)
const overview = computed(() => ownerIncomeStore.overview)
const summary = computed(() => ownerIncomeStore.selectedSummary)
const memberList = computed(() => ownerIncomeStore.selectedMemberList)

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

function onMembersSort(sort: OwnerIncomeMemberSort): void {
  void setMembersSort(sort)
}

function onMembersDirection(direction: OwnerIncomeSortDirection): void {
  void setMembersDirection(direction)
}

function onLoadMoreMembers(): void {
  void loadMoreMembers()
}

function onRetryMembers(): void {
  void retryMembers()
}

function onOpenMember(member: OwnerIncomeMemberRow): void {
  void openMember(member)
}

function onRetryMemberSheet(): void {
  void retryMemberSheet()
}

onBeforeUnmount(() => {
  cancelPendingSearch()
  closeMember()
})

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

          <!-- Members list (re-keyed per cycle so the search box shows that cycle's term) -->
          <div v-if="memberList" class="space-y-3">
            <h2 class="text-sm font-semibold">Members</h2>
            <AgencyIncomeMembersToolbar
              :key="`members-toolbar-${ownerIncomeStore.selectedCycle}`"
              :search="memberList.search"
              :sort="memberList.sort"
              :direction="memberList.direction"
              @search="setMembersSearch"
              @sort="onMembersSort"
              @direction="onMembersDirection"
            />
            <AgencyIncomeMembersList
              :rows="memberList.rows"
              :has-more="memberList.hasMore"
              :loading-page="memberList.loadingPage"
              :search="memberList.search"
              :error="memberList.error"
              @load-more="onLoadMoreMembers"
              @retry="onRetryMembers"
              @open-member="onOpenMember"
            />
          </div>
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

      <!-- Member sheet (one instance, over the list) -->
      <AgencyIncomeMemberIncomeSheet
        :open="ownerIncomeStore.openMember !== null"
        :member="ownerIncomeStore.openMember?.member ?? null"
        :sheet="ownerIncomeStore.openMemberSheet"
        :loading="ownerIncomeStore.isMemberSheetLoading"
        :error="ownerIncomeStore.memberSheetError"
        @close="closeMember"
        @retry="onRetryMemberSheet"
      />
    </div>
  </main>
</template>
