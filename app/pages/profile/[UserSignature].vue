<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { useInfiniteScroll } from '@vueuse/core'
import type { UserProfile } from '~/types/user/user-profile'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'profile',
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
const authStore = useAuthStore()

// ========================================
// State
// ========================================

const signature = computed(() => route.params.UserSignature as string)
const giftsContainerRef = ref<HTMLElement | null>(null)
const followAnimating = ref(false)

// ========================================
// User Profile Composable
// ========================================

const {
  profile: readonlyProfile,
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

// Writable copy for optimistic count updates by useFollow
const profileWritable = ref<UserProfile | null>(readonlyProfile.value as UserProfile | null)
watch(readonlyProfile, (v) => { profileWritable.value = v ? { ...v, gifts_received: [...v.gifts_received] } as UserProfile : null })

// ========================================
// Follow Composable
// ========================================

const profileId = computed(() => profileWritable.value?.id ?? null)
const {
  isFollowing,
  isFollowedBy: _isFollowedBy,
  isToggling,
  isSelf,
  buttonLabel,
  buttonIcon,
  toggleFollow,
  statusLoaded,
} = useFollow(profileId, profileWritable)

/**
 * Whether the current profile is the auth user's own profile.
 */
const isOwnProfile = computed(() => {
  return authStore.user?.id === profileWritable.value?.id
})

/**
 * Computed followers/following counts that react to global store for own profile (real-time fix).
 */
const followersCount = computed(() => {
  return isOwnProfile.value ? (authStore.user?.followers_count ?? 0) : (profileWritable.value?.followers_count ?? 0)
})

const followingCount = computed(() => {
  return isOwnProfile.value ? (authStore.user?.following_count ?? 0) : (profileWritable.value?.following_count ?? 0)
})

/**
 * Handle follow button click with animation trigger.
 */
async function handleFollowClick(): Promise<void> {
  const wasFollowing = isFollowing.value
  await toggleFollow()

  // Trigger particle burst on successful follow (not unfollow)
  if (!wasFollowing && isFollowing.value) {
    followAnimating.value = true
    setTimeout(() => { followAnimating.value = false }, 600)
  }
}

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
const { isTracking, isJoiningRoom, trackUser, goToRoom } = useProfileRoomActions(readonlyProfile, enterRoom)
</script>

<template>
  <div>
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
    <ProfileHeader v-else-if="hasProfile">
      <template #cover>
        <NuxtImg
          :src="profileWritable?.cover_image ?? '/AppImages/dummy-card/bg-fl.png'"
          format="webp"
          densities="x1 x2"
          sizes="320px"
          width="100%"
          class="min-w-full aspect-rectangle object-cover h-48"
        />
      </template>

      <template #signature-badges>
        <ProfileBadge :txt="profileWritable?.signature || undefined" />
      </template>

      <template #avatar>
        <UserAvatar
          :animated="true"
          :frame-asset-url="profileWritable?.frame ?? 'https://assets.flyliveapp.com/frames/10.svga'"
          :img="profileWritable?.avatar ?? 'AppImages/dummy-card/avatar.png'"
          class="w-24 -mt-15"
        />
      </template>

      <template #badges>
        <ProfileBadge :badge-src="wealthBadgeSrc" color="tertiary" :txt="String(wealthLevel)" />
        <ProfileBadge :badge-src="charmBadgeSrc" color="secondary" :txt="String(charmLevel)" />
      </template>

      <template #name>
        {{ profileWritable?.name }}
      </template>

      <template #stats>
        <UserStats
          class="mt-1"
          :wealth-xp="profileWritable?.wealth_xp"
          :charm-xp="profileWritable?.charm_xp"
          :visits="String(profileWritable?.profile_visits)"
          :followers="String(followersCount)"
          :following="String(followingCount)"
          :user-id="profileWritable?.id"
          :is-follow-list-public="profileWritable?.is_follow_list_public ?? true"
          :is-own-profile="isOwnProfile"
        />
      </template>
    </ProfileHeader>

    <SectionTitle class="mt-6 mb-2 mx-3">Cp RelationShips</SectionTitle>

    <EventsProfileCard />

    <!-- Agency Section (conditional) -->
    <template v-if="hasAgency && profileWritable?.agency">
      <SectionTitle class="mt-4 mb-2 mx-3">Agency</SectionTitle>
      <NuxtLink
        :to="`/agency/${profileWritable.agency.id}`"
        class="mx-3 grid grid-cols-12 bg-linear-to-br to-primary-950 rounded-md overflow-hidden border border-primary gap-2"
      >
        <div class="col-span-2 p-1">
          <NuxtImg :src="profileWritable.agency.logo" class="w-full aspect-square object-cover" />
        </div>

          <div class="col-span-6">
            <p class="text-md font-bold truncate">{{ profileWritable.agency.name }}</p>

            <div class="flex">
              <UIcon :name="`i-flag-${profileWritable.agency.country.toLowerCase()}-4x3`" class="ssize-6 rounded inline mr-1" />
              <p class="text-sm text-muted! font-semibold truncate">
                {{ profileWritable.agency.country }}
              </p>
            </div>
          </div>

          <div class="col-span-3 flex flex-col justify-center py-2">
            <div class="flex gap-1 items-center">
              <UBadge icon="i-lucide-users" square class="rounded-full text-white" />
              <p class="text-xs font-bold leading-none">
                {{ profileWritable.agency.total_member_count }} <br> Members
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

            <!-- Follow Button (hidden for own profile) -->
            <UButton
              v-if="!isSelf && statusLoaded"
              :loading="isToggling"
              :disabled="isToggling"
              :icon="buttonIcon"
              :variant="isFollowing ? 'solid' : 'outline'"
              :color="isFollowing ? 'primary' : 'neutral'"
              size="sm"
              class="pl-1 pr-2 gap-1 follow-btn transition-all duration-150"
              :class="{
                'follow-btn--animating': followAnimating,
                'follow-btn--active': isFollowing,
              }"
              @click="handleFollowClick"
            >
              {{ buttonLabel }}
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
  </div>
</template>

<style scoped>
/* ── Follow Button Micro-Animations ── */

.follow-btn {
  position: relative;
  overflow: visible;
  transform: scale(1);
}

/* Scale bounce on animating */
.follow-btn--animating {
  animation: follow-bounce 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes follow-bounce {
  0% { transform: scale(1); }
  30% { transform: scale(0.92); }
  60% { transform: scale(1.12); }
  100% { transform: scale(1); }
}

/* Active state glow */
.follow-btn--active {
  box-shadow: 0 0 12px -2px var(--color-primary-400);
}

/* ── Particle Burst ── */
.follow-btn--animating::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  animation: follow-burst 500ms ease-out forwards;
  background:
    radial-gradient(circle at 20% 30%, var(--color-primary-400) 2px, transparent 2px),
    radial-gradient(circle at 80% 25%, var(--color-primary-300) 1.5px, transparent 1.5px),
    radial-gradient(circle at 50% 10%, var(--color-primary-500) 2px, transparent 2px),
    radial-gradient(circle at 15% 70%, var(--color-primary-300) 1.5px, transparent 1.5px),
    radial-gradient(circle at 85% 75%, var(--color-primary-400) 2px, transparent 2px),
    radial-gradient(circle at 50% 90%, var(--color-primary-500) 1.5px, transparent 1.5px);
}

@keyframes follow-burst {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2.5);
    opacity: 0;
  }
}
</style>