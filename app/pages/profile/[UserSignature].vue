<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { useInfiniteScroll } from '@vueuse/core'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Constants
// ========================================

const TAB_ITEMS = [
  {
    label: 'Gifts',
    icon: 'i-lucide-gift',
    slot: 'gifts',
  },
  {
    label: 'Entries',
    icon: 'i-lucide-door-open',
    slot: 'entries',
  },
  {
    label: 'Frames',
    icon: 'i-lucide-frame',
    slot: 'frames',
  },
]

// ========================================
// Composables / Injected Dependencies
// ========================================

const route = useRoute()

// ========================================
// State
// ========================================

const signature = computed(() => route.params.UserSignature as string)
const giftsContainerRef = ref<HTMLElement | null>(null)

// ========================================
// User Profile Composable
// ========================================

const {
  profile,
  loading,
  error,
  hasProfile,
  hasAgency,
  hasRoom,
  allGifts,
  wealthLevel,
  charmLevel,
  wealthBadgeSrc,
  charmBadgeSrc,
  giftsLoading,
  giftsHasMore,
  fetchMoreGifts,
} = useUserProfile(signature)

// ========================================
// Infinite Scroll for Gifts
// ========================================

useInfiniteScroll(
  giftsContainerRef,
  async () => {
    if (giftsHasMore.value && !giftsLoading.value) {
      await fetchMoreGifts()
    }
  },
  { distance: 200 }
)

// ========================================
// User Tracking
// ========================================

const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
const { isTracking, isJoiningRoom, trackUser, goToRoom } = useProfileRoomActions(profile, enterRoom)
</script>

<template>
  <main>
    <NavAlt sub-menu-to="/">Public Profile</NavAlt>

    <!-- Loading State -->
    <div v-if="loading" class="pt-14 px-3 space-y-4">
      <div class="flex flex-col justify-center min-h-[55vw] bg-linear-to-br to-primary/30 rounded-lg p-3">
        <div class="flex gap-3">
          <USkeleton class="size-24 rounded-full" />
          <div class="flex-1 space-y-2 py-2">
            <USkeleton class="h-6 rounded w-3/4" />
            <USkeleton class="h-4 rounded w-1/2" />
            <div class="flex gap-2">
              <USkeleton class="h-6 rounded w-16" />
              <USkeleton class="h-6 rounded w-16" />
            </div>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-5 gap-2">
        <USkeleton v-for="i in 5" :key="i" class="h-12 rounded" />
      </div>
      <USkeleton class="h-32 rounded-lg" />
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="pt-14 px-3">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="error"
        :description="'Unable to load profile for @' + signature"
      />
      <UButton
        to="/"
        class="mt-4 w-full justify-center"
        icon="i-lucide-arrow-left"
      >
        Go Back
      </UButton>
    </div>

    <!-- Profile Content -->
    <template v-else-if="hasProfile">
      <AltHero class="bg-linear-to-br to-primary/30" :image-src="profile?.cover_image ?? undefined">
        <UserAvatar
          :animated="true"
          :img="profile?.avatar ?? undefined"
          :frame-asset-url="profile?.frame ?? undefined"
          class="w-24"
        />
        <div class="px-3">
          <h1 class="text-lg font-bold">{{ profile?.name || 'Anonymous' }}</h1>
          <ProfileBadge :txt="profile?.signature" />
          <div class="flex gap-2 mt-1">
            <!-- Dynamic level badges computed from user's XP -->
            <ProfileBadge
                :badge-src="wealthBadgeSrc"
                color="tertiary"
                :txt="String(wealthLevel)"
            />
            <ProfileBadge
                :badge-src="charmBadgeSrc"
                color="secondary"
                :txt="String(charmLevel)"
            />
          </div>
        </div>
      </AltHero>

      <!-- User Stats -->
      <UserStats
        class="mt-1"
        :wealth-xp="profile?.wealth_xp"
        :charm-xp="profile?.charm_xp"
        :visits="String(profile?.profile_visits)"
      />

      <SectionTitle class="mt-6 mb-2 mx-3">Cp RelationShips</SectionTitle>

      <EventsProfileCard />

      <!-- Agency Section (conditional) -->
      <template v-if="hasAgency && profile?.agency">
        <SectionTitle class="mt-4 mb-2 mx-3">Agency</SectionTitle>
        <NuxtLink
          :to="`/agency/${profile.agency.id}`"
          class="mx-3 grid grid-cols-12 bg-linear-to-br to-primary-950 rounded-md overflow-hidden border border-primary gap-2"
        >
          <div class="col-span-2 p-1">
            <NuxtImg :src="profile.agency.logo" class="w-full aspect-square object-cover" />
          </div>

          <div class="col-span-6">
            <p class="text-md font-bold truncate">{{ profile.agency.name }}</p>

            <div class="flex">
              <UIcon :name="`i-flag-${profile.agency.country.toLowerCase()}-4x3`" class="ssize-6 rounded inline mr-1" />
              <p class="text-sm text-muted! font-semibold truncate">
                {{ profile.agency.country }}
              </p>
            </div>
          </div>

          <div class="col-span-3 flex flex-col justify-center py-2">
            <div class="flex gap-1 items-center">
              <UBadge icon="i-lucide-users" square class="rounded-full text-white" />
              <p class="text-xs font-bold leading-none">
                {{ profile.agency.total_member_count }} <br> Members
              </p>
            </div>
          </div>
        </NuxtLink>
      </template>

      <!-- No Agency Message -->
      <template v-else>
        <SectionTitle class="mt-4 mb-2 mx-3">Agency</SectionTitle>
        <div class="mx-3 p-4 bg-muted/20 rounded-lg text-center text-muted">
          <Icon name="i-lucide-building-2" class="size-8 mx-auto mb-2 opacity-50" />
          <p class="text-sm">Not a member of any agency</p>
        </div>
      </template>

      <!-- History Section -->
      <div ref="giftsContainerRef" class="p-3 mb-12">
        <SectionTitle class="mt-4">History</SectionTitle>

        <UTabs class="w-full" variant="link" :items="TAB_ITEMS">
          <!-- Gifts Tab -->
          <template #gifts>
            <!-- Empty State -->
            <div v-if="allGifts.length === 0 && !giftsLoading" class="py-8 text-center text-muted">
              <Icon name="i-lucide-gift" class="size-10 mx-auto mb-2 opacity-50" />
              <p>No gifts received yet</p>
            </div>

            <!-- Gifts Grid -->
            <div v-else class="grid grid-cols-3 gap-2">
              <ProfileHistoryCard
                v-for="(gift, index) in allGifts"
                :key="`gift-${index}`"
                :badge-src="gift.thumbnail_url"
                :item-name="gift.label"
                :quantity="gift.total_quantity_received"
                :rarity="gift.rarity"
              />
            </div>

            <!-- Loading More Indicator -->
            <div v-if="giftsLoading" class="py-4 text-center">
              <UButton loading variant="ghost" disabled>Loading more...</UButton>
            </div>

            <!-- End of List -->
            <div v-else-if="allGifts.length > 0 && !giftsHasMore" class="py-4 text-center text-muted text-sm">
              You've seen all gifts
            </div>
          </template>

          <!-- Entries Tab (Placeholder) -->
          <template #entries>
            <div class="py-8 text-center text-muted">
              <Icon name="i-lucide-door-open" class="size-10 mx-auto mb-2 opacity-50" />
              <p>Room entries coming soon</p>
            </div>
          </template>

          <!-- Frames Tab (Placeholder) -->
          <template #frames>
            <div class="py-8 text-center text-muted">
              <Icon name="i-lucide-frame" class="size-10 mx-auto mb-2 opacity-50" />
              <p>Frames coming soon</p>
            </div>
          </template>
        </UTabs>
      </div>

      <!-- Action Footer -->
      <footer
        aria-label="Primary"
        class="fixed inset-x-2 z-50 bottom-4"
      >
        <BgGlass
          class="border border-white/40"
          frost-blur-radius="blur(4px)"
          :noise-frequency="0.009"
          :noise-strength="200"
          rounded="rounded-lg"
        >
          <div class="flex justify-between items-center px-1 py-1 gap-2 touch-manipulation select-none">
            <UButton
              :loading="isTracking"
              :disabled="isTracking"
              icon="i-lucide-locate-fixed"
              size="sm"
              class="pl-1 pr-2 gap-1"
              @click="trackUser"
            >
              Track
            </UButton>
            <UButton to="/" icon="i-lucide-star" size="sm" class="pl-1 pr-2 gap-1">
              Follow
            </UButton>
            <UButton
              v-if="hasRoom"
              :loading="isJoiningRoom"
              :disabled="isJoiningRoom"
              icon="i-lucide-video"
              size="sm"
              class="pl-1 pr-2 gap-1"
              @click="goToRoom"
            >
              Room
            </UButton>
            <UButton v-else disabled icon="i-lucide-video-off" size="sm" class="pl-1 pr-2 gap-1">
              No Room
            </UButton>
            <UButton to="/" icon="i-lucide-message-circle-more" size="sm" class="pl-1 pr-2 gap-1">
              Chat
            </UButton>
          </div>
        </BgGlass>
      </footer>
    <!-- Password Prompt Modal (for password-protected rooms) -->
    <RoomPasswordPromptModal
      v-if="showPasswordPrompt && pendingRoom"
      v-model:open="showPasswordPrompt"
      :room="pendingRoom"
      @success="onPasswordSuccess"
    />
    </template>
  </main>
</template>