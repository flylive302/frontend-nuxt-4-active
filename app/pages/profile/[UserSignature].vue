<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Imports & Types
// ========================================

import { useInfiniteScroll } from '@vueuse/core'
import type { UserProfile } from '~/types/user/user-profile'
import {computed} from "vue";
import MarqueeName from "~/components/common/marquee-name.vue";

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
  wealthBadgeSrc,
  charmBadgeSrc,
  equippedBadges,
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
 * Computed followers/following counts that react to the global store for own profile (real-time fix).
 */
const followersCount = computed(() => {
  return isOwnProfile.value ? (authStore.user?.followers_count ?? 0) : (profileWritable.value?.followers_count ?? 0)
})

const followingCount = computed(() => {
  return isOwnProfile.value ? (authStore.user?.following_count ?? 0) : (profileWritable.value?.following_count ?? 0)
})

/**
 * Handle follow button click with the animation trigger.
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
const { resolvePropAsset } = usePropLookup()

// ========================================
// Report User
// ========================================
const showReportModal = ref(false)

const dataCardAsset = computed(() =>
    resolvePropAsset(profileWritable?.value?.data_card_id) ?? null
)

const isVap = computed(() => dataCardAsset.value?.endsWith('.mp4') ?? false)
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
          :src="profileWritable?.cover_image ?? ASSETS.PROFILE_COVER_PLACEHOLDER"
          format="webp"
          densities="x1 x2"
          sizes="320px"
          width="100%"
          class="min-w-full aspect-rectangle object-cover h-48 animate-[zoom_15s_ease-in-out_infinite]"
        />
      </template>

      <template #card>
        <div v-if="dataCardAsset" class="absolute z-0 overflow-hidden -mt-26">
          <SvgaPlayer
              v-if="!isVap"
              :key="`data-card-svga-${profileWritable?.data_card_id}`"
              :name="dataCardAsset"
              class="pointer-events-none mt-[-24vw]"
          />
          <VapPlayer
              v-else
              :key="`data-card-vap-${profileWritable?.data_card_id}`"
              :name="dataCardAsset"
              class="pointer-events-none mt-[-24vw]"
          />
        </div>
      </template>

      <template #signature-badges>
        <div class="w-full flex justify-center items-center gap-1" :class="dataCardAsset ? 'pt-10' : 'pt-2'">
          <ProfileBadge :show-badge="false" :txt="profileWritable?.signature || undefined" class="w-8/12" />
          <img v-if="profileWritable?.vip_level" :src="`https://ik.imagekit.io/flylive/vip/${profileWritable.vip_level}/badge.png`" class="w-4/12" alt="">
        </div>
      </template>

      <template #avatar>
        <div class="mt-[-12vw] w-9/12">
          <UserAvatar
            :animated="true"
            :frame-asset-url="resolvePropAsset(profileWritable?.frame_id) ?? undefined"
            :img="profileWritable?.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
            class="w-full"
          />
        </div>
      </template>

      <template #badges>
        <div class="flex justify-start items-center w-full relative z-10" :class="dataCardAsset ? 'pt-10' : 'pt-2'">
          <img :src="charmBadgeSrc" alt="current badge" class="w-5/12" >
          <img :src="wealthBadgeSrc" alt="current badge" class="w-7/12" >
        </div>
      </template>

      <template #marquee>
        <BadgesEquippedBadgeMarquee :equipped-badges="equippedBadges" class="mx-4 mt-2" />
      </template>

      <template #name>
        <MarqueeName
            class="mx-auto max-w-36"
            text-class="text-lg leading-none font-bold"
            :name="profileWritable?.name || ''"
            delay="0.5s"
        />
      </template>

      <template #stats>
        <div class="rounded-xl glowing-border overflow-hidden relative z-10 mt-2" :class="dataCardAsset ? 'mx-6' : 'mx-4'">
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
        </div>
      </template>
    </ProfileHeader>

    <div class="max-h-[58vh] overflow-scroll relative z-50 mt-2">
      <SectionTitle class="mx-8">Cp RelationShips</SectionTitle>
      <EventsProfileCard class="mx-4"/>

      <!-- Agency Section (conditional) -->
      <div v-if="hasAgency && profileWritable?.agency" class="relative z-50 mt-4">
        <SectionTitle class="mx-8">Agency</SectionTitle>
        <NuxtLink
            :to="`/agency/${profileWritable.agency.id}`"
            class="flex rounded-md overflow-hidden gap-2 glowing-border mx-8"
        >
          <div class="p-1 w-2/6">
            <NuxtImg :src="profileWritable.agency.logo" class="w-full aspect-square object-cover" />
          </div>

          <div class="w-full flex flex-col gap-2 py-1">
            <p class="text-md font-bold truncate">{{ profileWritable.agency.name }}</p>

            <div class="flex gap-2 items-center">
              <div class="flex pt-1 gap-1 items-center">
                <UIcon :name="`i-flag-${profileWritable.agency.country.toLowerCase()}-4x3`" class="ssize-6 rounded inline mr-1" />
                <p class="text-sm text-muted! font-semibold truncate">
                  {{ profileWritable.agency.country }}
                </p>
              </div>

              <div class="flex items-center mt-1 gap-1">
                <UBadge icon="i-lucide-users" square class="rounded-full text-white" variant="soft" />
                <p class="text-xs font-bold leading-none">
                  {{ profileWritable.agency.total_member_count }}
                </p>
              </div>
            </div>

          </div>

        </NuxtLink>
      </div>

      <!-- History Section -->
      <div ref="giftsContainerRef" class="mb-12 mt-4 relative z-30">
        <SectionTitle class="mx-8">History</SectionTitle>

        <UTabs class="w-full px-8" variant="link" :items="TAB_ITEMS" :ui="{label: 'text-white'}">
          <!-- Gifts Tab -->
          <template #gifts>
            <!-- Empty State -->
            <div v-if="allGifts.length === 0 && !giftsLoading" class="py-8 text-center text-muted">
              <Icon name="i-lucide-gift" class="size-10 mx-auto mb-2 opacity-50" />
              <p>No gifts received yet</p>
            </div>

            <!-- Gifts Grid -->
            <div v-else class="grid grid-cols-4 gap-2 mt-4">
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
    </div>

    <!-- Action Footer -->
    <footer
      aria-label="Primary"
      class="fixed inset-x-2 z-50 bottom-4"
    >
      <div v-if="profileId !== authStore.user?.id" class="flex justify-between items-center px-1 py-1 gap-2 touch-manipulation select-none">
        <UButton
            :loading="isTracking"
            :disabled="isTracking"
            icon="i-mdi-airplane-search"
            size="md"
            variant="subtle"
            class="pl-1 pr-2 gap-1 backdrop-blur-xs"
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
            :variant="isFollowing ? 'subtle' : 'soft'"
            size="md"
            class="pl-1 pr-2 gap-1 follow-btn transition-all duration-150 backdrop-blur-xs"
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
            size="md"
            variant="subtle"
            class="pl-1 pr-2 gap-1 backdrop-blur-xs"
            @click="goToRoom"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="size-6 drop-shadow-md" width="14" height="14" viewBox="0 0 14 14">
            <g fill="none">
              <path fill="#000000" fill-rule="evenodd" d="M2.708 3.507a5.662 5.662 0 1 0 8.218 2.74l-.222-.073a1.65 1.65 0 0 1-.541.911a1.65 1.65 0 0 1-1.577.314h-.002l-1.258-.405a1.64 1.64 0 0 1-1.08-1.117l-.339-1.163l-2.413-.777a2 2 0 0 1-.786-.43" clip-rule="evenodd"/>
              <path fill="#ffffff" fill-rule="evenodd" d="M2.708 3.507A5.66 5.66 0 0 0 .173 9.73h3.195a1.36 1.36 0 0 0 1.359-1.36V7.25a1.36 1.36 0 0 1 1.359-1.404q.075 0 .149-.008l-.328-1.123l-2.413-.777a2 2 0 0 1-.786-.43Zm8.33 6.614l-.947-.694a2.8 2.8 0 0 0-1.239-.31H7.215a1.35 1.35 0 0 0 0 2.688a.953.953 0 0 1 .962.95v.657a5.68 5.68 0 0 0 2.86-3.29Z" clip-rule="evenodd"/>
              <path fill="#ff2465" d="M13.772 1.527L12.7 1.163a.364.364 0 0 0-.418.139l-.782 1.21L7.213.37a2.668 2.668 0 0 0-3.868 1.403a.73.73 0 0 0 .503.965l2.797.9l.279.097l.525 1.8a.39.39 0 0 0 .257.268l1.265.407a.397.397 0 0 0 .514-.44l-.278-1.339h.182l2.732.89a.72.72 0 0 0 .911-.44l.965-2.968a.364.364 0 0 0-.225-.386"/>
            </g>
          </svg>
          Room
        </UButton>

        <UButton :to="`/inbox?start=${profileId}`" icon="i-lucide-message-circle-more" variant="subtle" size="md" class="pl-1 pr-2 gap-1 backdrop-blur-xs">
          Chat
        </UButton>

        <UButton
          icon="i-lucide-flag"
          variant="soft"
          size="md"
          color="warning"
          class="backdrop-blur-xs"
          @click="showReportModal = true"
        />
      </div>
    </footer>

    <!-- Report User Modal -->
    <ReportModal
      v-if="profileId && profileId !== authStore.user?.id"
      v-model:open="showReportModal"
      reportable-type="user"
      :reportable-id="profileId"
    />

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