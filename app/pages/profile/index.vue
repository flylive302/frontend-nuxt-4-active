<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const authStore = useAuthStore()
const levelsStore = useLevelsStore()
const agencyStore = useAgencyStore()
const { fetchUserAgency } = useAgencyMembership()
const { fetchReceivedInvitations } = useAgencyInvitations()
const { fetchMyJoinRequests } = useAgencyJoinRequests()

const CURRENT_WEALTH_BADGE = levelsStore.wealthBadge == null ? '/badges/wealth/level_0.webp' : levelsStore.wealthBadge.image_url;
const CURRENT_CHARM_BADGE = levelsStore.charmBadge == null ? '/badges/charm/level_0.webp' : levelsStore.charmBadge.image_url;
const CURRENT_WEALTH_LEVEL = levelsStore.wealthLevel?.current_level || '0';
const CURRENT_CHARM_LEVEL = levelsStore.charmLevel?.current_level || '0';

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  // Fetch user's agency context for conditional navigation
  fetchUserAgency()
  fetchReceivedInvitations()
  fetchMyJoinRequests()
})
</script>

<template>
  <main>
    <NavAlt sub-menu-to="/profile/edit">My Profile</NavAlt>

    <AltHero class="z-20">
      <div class="flex flex-col justify-center min-h-[55vw] bg-linear-to-br to-primary/30">
        <NuxtLink 
          v-if="authStore.user" 
          :to="{ path: '/profile/' + authStore.user.signature }" 
          class="flex px-3"
        >
          <UserAvatar :animated="true" :frame-name="authStore?.user?.frame ?? undefined" :img="authStore.user.avatar ?? undefined" class="w-24" />
          <div class="px-3">
            <h1 class="text-lg font-bold underline">{{ authStore.user?.name }}</h1>
            <ProfileBadge :txt="authStore?.user?.signature || undefined" />
            <div class="flex gap-2">
              <ProfileBadge :badge-src="CURRENT_WEALTH_BADGE" color="tertiary" :txt="CURRENT_WEALTH_LEVEL" />
              <ProfileBadge :badge-src="CURRENT_CHARM_BADGE" color="secondary" :txt="CURRENT_CHARM_LEVEL" />
            </div>
          </div>
        </NuxtLink>
      </div>
    </AltHero>

    <UserStats 
      class="mt-1" 
      :wealth-xp="authStore.user?.wealth_xp ?? '0'"
      :charm-xp="authStore.user?.charm_xp ?? '0'"
    />

    <SectionTitle class="mt-6 mb-2 mx-3">Cp RelationShips</SectionTitle>

    <EventsProfileCard />

    <div class="p-3 mb-12">
      <NavProfileItem to="/wallet/purchase-coins" icon="i-lucide-wallet" txt="Wallet" />
      <NavProfileItem to="/mall/" icon="i-lucide-store" txt="Mall" />
      <NavProfileItem to="/levels/wealth" icon="i-lucide-arrow-up-wide-narrow" txt="Levels" />
      <NavProfileItem to="/badges" icon="i-lucide-award" txt="Badges" />
      <NavProfileItem to="/vip/1" icon="i-lucide-crown" txt="VIP" />

      <!-- Agency Section -->
      <SectionTitle class="mt-4 mb-2">Agency</SectionTitle>
      
      <!-- Browse Agencies (always visible) -->
      <NavProfileItem 
        to="/agency/list" 
        icon="i-lucide-building-2" 
        txt="Browse Agencies" 
      />
      
      <!-- My Agency (visible if member/owner) -->
      <NavProfileItem 
        v-if="agencyStore.isAgencyMember"
        to="/agency/my-agency" 
        icon="i-lucide-home" 
        txt="My Agency" 
      />
      
      <!-- My Income (visible if agency member) -->
      <NavProfileItem 
        v-if="agencyStore.isAgencyMember"
        to="/agency/my-income" 
        icon="i-lucide-dollar-sign" 
        txt="My Income" 
      />
      
      <!-- Agency Invitations (visible if not agency member) -->
      <NavProfileItem 
        v-if="!agencyStore.isAgencyMember"
        to="/agency/invitations" 
        icon="i-lucide-mail" 
        txt="Agency Invitations"
        :badge="agencyStore.receivedInvitations.items.length || undefined"
      />
      
      <!-- My Join Requests (visible if not agency member) -->
      <NavProfileItem 
        v-if="!agencyStore.isAgencyMember"
        to="/agency/my-requests" 
        icon="i-lucide-user-plus" 
        txt="My Join Requests"
        :badge="agencyStore.myJoinRequests.items.filter(r => r.status === 'pending').length || undefined"
      />
      
      <!-- Create Agency (visible if not in agency) -->
      <NavProfileItem 
        v-if="!agencyStore.isAgencyMember"
        to="/agency/create" 
        icon="i-lucide-plus-circle" 
        txt="Create Agency" 
      />
      
      <UButton 
        class="w-full justify-center mt-4" 
        icon="i-lucide-power-off" 
        size="xl" 
        @click="authStore.logout"
      >
        Logout
      </UButton>
    </div>
  </main>
</template>