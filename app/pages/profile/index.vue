<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'profile',
  middleware: 'auth',
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const authStore = useAuthStore()
const agencyStore = useAgencyStore()
const { getBadgeFromXp, getLevelFromXp } = useLevelLookup()
const { fetchUserAgency } = useAgencyMembership()
const { fetchReceivedInvitations } = useAgencyInvitations()
const { fetchMyJoinRequests } = useAgencyJoinRequests()

const CURRENT_WEALTH_BADGE = computed(() => getBadgeFromXp(authStore.user?.wealth_xp, 'wealth'))
const CURRENT_CHARM_BADGE = computed(() => getBadgeFromXp(authStore.user?.charm_xp, 'charm'))
const CURRENT_WEALTH_LEVEL = computed(() => String(getLevelFromXp(authStore.user?.wealth_xp, 'wealth').level))
const CURRENT_CHARM_LEVEL = computed(() => String(getLevelFromXp(authStore.user?.charm_xp, 'charm').level))

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
  <div>
    <ProfileHeader>
      <template #cover>
        <NuxtImg
          :src="authStore.user?.cover_image ?? '/AppImages/dummy-card/bg-fl.png'"
          format="webp"
          densities="x1 x2"
          sizes="320px"
          width="100%"
          class="min-w-full aspect-rectangle object-cover h-48 animate-[zoom_80s_ease-in-out_infinite]"
        />
      </template>

      <template #signature-badges>
        <ProfileBadge :txt="authStore?.user?.signature || undefined" />
      </template>

      <template #avatar>
        <NuxtLink :to="{ path: '/profile/' + authStore.user?.signature }" class="-mt-15">
          <UserAvatar
            :animated="true"
            :frame-asset-url="authStore?.user?.frame ?? undefined"
            :img="authStore.user?.avatar ?? 'AppImages/dummy-card/avatar.png'"
            class="w-24"
          />
        </NuxtLink>
      </template>

      <template #badges>
        <ProfileBadge :badge-src="CURRENT_WEALTH_BADGE" color="tertiary" :txt="CURRENT_WEALTH_LEVEL" />
        <ProfileBadge :badge-src="CURRENT_CHARM_BADGE" color="secondary" :txt="CURRENT_CHARM_LEVEL" />
      </template>

      <template #name>
        {{ authStore.user?.name }}
      </template>

      <template #stats>
        <UserStats 
          class="mt-2" 
          :wealth-xp="authStore.user?.wealth_xp ?? '0'"
          :charm-xp="authStore.user?.charm_xp ?? '0'"
          :followers="String(authStore.user?.followers_count ?? 0)"
          :following="String(authStore.user?.following_count ?? 0)"
          :user-id="authStore.user?.id ?? null"
          :is-follow-list-public="true"
          :is-own-profile="true"
        />
      </template>
    </ProfileHeader>

    <!-- 
      <SectionTitle class="mt-6 mb-2 mx-3">Cp RelationShips</SectionTitle>
      <EventsProfileCard /> 
    -->

    <div class="px-4 mb-12">
      <NavProfileItem to="/wallet/purchase-coins" icon="i-lucide-wallet" txt="Wallet" />
      <NavProfileItem to="/mall/" icon="i-lucide-store" txt="Mall" />
      <NavProfileItem to="/levels/wealth" icon="i-lucide-arrow-up-wide-narrow" txt="Levels" />
      <NavProfileItem to="/badges" icon="i-lucide-award" txt="Badges" />
      <NavProfileItem to="/vip" icon="i-lucide-crown" txt="VIP" />
      <NavProfileItem to="/profile/follows" icon="i-lucide-users" txt="Followers & Following" />

      <!-- Agency Section -->
      <SectionTitle class="mt-4 mb-2 border-b-2 border-primary pb-2">Agency</SectionTitle>
      
      <!-- Browse Agencies (always visible) -->
      <NavProfileItem to="/agency/list" icon="i-lucide-building-2" txt="Browse Agencies" />
      
      <!-- My Agency (visible if member/owner) -->
      <NavProfileItem v-if="agencyStore.isAgencyMember" to="/agency/my-agency" icon="i-lucide-home" txt="My Agency" />
      
      <!-- My Income (visible if agency member) -->
      <NavProfileItem v-if="agencyStore.isAgencyMember" to="/agency/my-income" icon="i-lucide-dollar-sign" txt="My Income" />
      
      <!-- Agency Invitations (visible if not agency member) -->
      <NavProfileItem v-if="!agencyStore.isAgencyMember" to="/agency/invitations" icon="i-lucide-mail" txt="Agency Invitations" :badge="agencyStore.receivedInvitations.items.length || undefined" />
      
      <!-- My Join Requests (visible if not agency member) -->
      <NavProfileItem v-if="!agencyStore.isAgencyMember" to="/agency/my-requests" icon="i-lucide-user-plus" txt="My Join Requests" :badge="agencyStore.myJoinRequests.items.filter(r => r.status === 'pending').length || undefined" />
      
      <!-- Create Agency (visible if not in agency) -->
      <NavProfileItem v-if="!agencyStore.isAgencyMember" to="/agency/create" icon="i-lucide-plus-circle" txt="Create Agency" />

    </div>
  </div>
</template>