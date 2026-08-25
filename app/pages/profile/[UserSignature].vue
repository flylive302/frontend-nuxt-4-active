<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Imports & Types
// ========================================

import { useInfiniteScroll } from '@vueuse/core'
import type { UserProfile, PropPreviewItem } from '~/types/user/user-profile'
import type { ProfileImageType } from '~/composables/auth/useProfileImageUpload'
import {computed} from "vue";
import MarqueeName from "~/components/common/marquee-name.vue";
import UserTrackButton from "~/components/user/track-button.vue";

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'profile',
  middleware: 'auth',
  // Transitions are global (nuxt.config `app.viewTransition: true`): slides in/out
  // via the generic directional root slide (no avatar morph on this pair, since the
  // signature page skeletons before its header avatar mounts) — see main.css.
})

// ========================================
// Constants
// ========================================

const TAB_ITEMS = [
  {
    label: 'Gifts',
    icon: 'i-lucide-gift',
    slot: 'gifts',
    value: 'gifts',
  },
  {
    label: 'Entries',
    icon: 'i-lucide-door-open',
    slot: 'entries',
    value: 'entries',
  },
  {
    label: 'Frames',
    icon: 'i-lucide-frame',
    slot: 'frames',
    value: 'frames',
  },
  {
    label: 'Badges',
    icon: 'i-lucide-award',
    slot: 'badges',
    value: 'badges',
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
const profileScrollRef = ref<HTMLElement | null>(null)
const activeTab = ref('gifts')

// Shared follow celebration (styles live globally in assets/css/main.css)
const { followAnimating, burst } = useFollowBurst()

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
watch(readonlyProfile, (v) => {
  profileWritable.value = v ? { ...v, gifts_received: [...v.gifts_received] } as UserProfile : null
  // Zero-query freshness for the index page: when this IS our own profile, the
  // fetch above already carries the current server-side profile_visits. Push it
  // into the auth store so /profile reflects it instantly on back-navigation
  // (profile_visits has no realtime event of its own).
  if (v && v.id === authStore.user?.id) {
    authStore.patchProfile({ profile_visits: v.profile_visits })
  }
})

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
    burst()
  }
}

// ========================================
// Profile Props (Entries / Frames tabs)
// ========================================

const entriesProps = useProfileProps(signature, 'entry_animation')
const framesProps = useProfileProps(signature, 'frame')
const profileBadges = useProfileBadges(signature)

// Lazy-load each tab's first page on activation
watch(activeTab, (tab) => {
  if (tab === 'entries') entriesProps.ensureLoaded()
  if (tab === 'frames') framesProps.ensureLoaded()
  if (tab === 'badges') profileBadges.ensureLoaded()
})

// ========================================
// Prop / Gift Preview Modal
// ========================================

const previewItem = ref<PropPreviewItem | null>(null)
const previewOpen = ref(false)

function openPreview(item: PropPreviewItem): void {
  previewItem.value = item
  previewOpen.value = true
}

// ========================================
// Image Preview (cover / avatar)
// ========================================

const imagePreviewType = ref<ProfileImageType>('avatar')
const imagePreviewOpen = ref(false)
const { isUploading, progress, uploadProfileImage } = useProfileImageUpload()

// Reactive so the preview refreshes in place after a successful upload
const imagePreviewSrc = computed<string>(() =>
  imagePreviewType.value === 'avatar'
    ? profileWritable.value?.avatar ?? ASSETS.AVATAR_PLACEHOLDER
    : profileWritable.value?.cover_image ?? ASSETS.PROFILE_COVER_PLACEHOLDER
)

// Header cover — CDN-transformed (w-800) so the `h-48` box stops fetching the
// full-resolution original; `withImageKitTransform` returns '' for a nullish
// cover, so fall through to the local placeholder in that case.
const coverImageSrc = computed(() =>
  withImageKitTransform(profileWritable.value?.cover_image, { w: 1200, q: 75 }) || ASSETS.PROFILE_COVER_PLACEHOLDER
)

// VIP badge extension stays split (webp for vip<=2, png for vip>2) — same CDN
// verification as pages/profile/index.vue: neither extension exists for every
// level, so unifying would 404 half of them.
const vipBadgeSrc = computed(() => {
  const level = profileWritable.value?.vip_level
  if (!level) return ''
  return withImageKitTransform(`https://ik.imagekit.io/flylive/vip/${level}/badge.${level > 2 ? 'png' : 'webp'}`, { w: 256 })
})

function openImagePreview(type: ProfileImageType): void {
  imagePreviewType.value = type
  imagePreviewOpen.value = true
}

async function handlePreviewFileSelected(file: File): Promise<void> {
  const ok = await uploadProfileImage(imagePreviewType.value, file)
  // Sync the local writable profile copy with the freshly stored URL
  if (ok && profileWritable.value && authStore.user) {
    profileWritable.value = {
      ...profileWritable.value,
      avatar: authStore.user.avatar,
      cover_image: authStore.user.cover_image,
    }
  }
}

// ========================================
// Infinite Scroll for Active Tab
// ========================================

// Bound to the profile body — the element that actually scrolls. Binding this to
// the History block instead made `scrollHeight - scrollTop - clientHeight` a
// permanent ~0 (an unconstrained element is always "at the bottom"), so page 2
// fired the moment the profile resolved rather than on user scroll.
// Only these tabs paginate. `badges` is deliberately absent — useProfileBadges is
// a single-shot ensureLoaded() with no fetchMore, so an exhaustive lookup is used
// rather than a ternary: a fall-through would page a tab the user is not viewing.
function paginatedSourceForActiveTab() {
  if (activeTab.value === 'entries') return entriesProps
  if (activeTab.value === 'frames') return framesProps
  return null
}

useInfiniteScroll(
  profileScrollRef,
  async () => {
    if (activeTab.value === 'gifts') {
      if (giftsHasMore.value && !giftsLoading.value) {
        await fetchMoreGifts()
      }
      return
    }

    const source = paginatedSourceForActiveTab()
    if (!source) return

    if (source.loaded.value && source.hasMore.value && !source.loading.value) {
      await source.fetchMore()
    }
  },
  {
    distance: 200,
    // vueuse re-invokes onLoadMore for as long as there is room for more
    // content, so a container that does not overflow must never qualify —
    // that is a short page, not a scroll-to-bottom.
    canLoadMore: (el) => {
      if (!el || el.scrollHeight <= el.clientHeight) return false

      if (activeTab.value === 'gifts') {
        return giftsHasMore.value && !giftsLoading.value
      }

      const source = paginatedSourceForActiveTab()
      return !!source && source.loaded.value && source.hasMore.value && !source.loading.value
    },
  }
)

// ========================================
// User Tracking
// ========================================

const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
// Tracking now lives in <UserTrackButton>; this page keeps only room joining.
const { isJoiningRoom, goToRoom } = useProfileRoomActions(readonlyProfile, enterRoom)
const { resolvePropAsset } = usePropLookup()

// ========================================
// Report User
// ========================================
const showReportModal = ref(false)

const dataCardAsset = computed(() =>
    resolvePropAsset(profileWritable?.value?.data_card_id) ?? null
)

const isVap = computed(() => dataCardAsset.value?.endsWith('.mp4') ?? false)

// ========================================
// Header motion pause (capacitor-performance issue 08)
// ========================================
// Cover zoom + marquees pause via animation-play-state, and the data-card
// player defers mount, while the header is scrolled out of view.

const headerRef = ref<HTMLElement | null>(null)
const { isVisible: headerVisible } = useDeferredVisibility(headerRef, true)
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
    <div v-else-if="hasProfile" ref="headerRef">
    <ProfileHeader>
      <template #cover>
        <NuxtImg
          :src="coverImageSrc"
          format="webp"
          densities="x1 x2"
          sizes="320px"
          width="100%"
          class="min-w-full aspect-rectangle object-cover h-48 animate-[zoom_15s_ease-in-out_infinite] cursor-pointer"
          :style="{ animationPlayState: headerVisible ? 'running' : 'paused' }"
          @click="openImagePreview('cover')"
        />
      </template>

      <template #card>
        <div v-if="dataCardAsset && headerVisible" class="absolute z-0 overflow-hidden -mt-26">
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
          <ProfileBadge :vip="profileWritable?.vip_level" :txt="profileWritable?.signature || undefined" class="w-8/12" />
          <img v-if="profileWritable?.vip_level" :src="vipBadgeSrc" class="w-4/12" alt="">
        </div>
      </template>

      <template #avatar>
        <div class="mt-[-12vw] w-9/12 cursor-pointer" @click="openImagePreview('avatar')">
          <UserAvatar
            :animated="true"
            :frame-id="profileWritable?.frame_id"
            :user-name="profileWritable?.name"
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
        <BadgesEquippedBadgeMarquee :equipped-badges="equippedBadges" :paused="!headerVisible" class="mx-auto max-w-34" />
      </template>

      <template #name>
        <MarqueeName
            class="mx-auto max-w-36"
            text-class="text-lg leading-none font-bold"
            :name="profileWritable?.name || ''"
            delay="0.5s"
            :paused="!headerVisible"
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
    </div>

    <div ref="profileScrollRef" class="max-h-[58vh] overflow-scroll relative z-50 mt-2">
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
            <p class="text-md font-bold truncate">{{ profileWritable.agency.name }} - ID: {{ profileWritable.agency.id }}</p>

            <div class="flex gap-2 items-center">
              <div class="flex pt-1 gap-1 items-center">
                <CountryFlag :code="profileWritable.agency.country" class="ssize-6 rounded inline mr-1" />
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

      <AgencyInviteButton :user-id="profileId" :agency-id="profileWritable?.agency?.id" class="mt-2 mx-12" />

      <!-- History Section -->
      <div class="mb-12 mt-4 relative z-30">
        <SectionTitle class="mx-8">History</SectionTitle>

        <UTabs
            v-model="activeTab"
            class="w-full px-8"
            variant="link"
            :items="TAB_ITEMS"
            :ui="{
              label: 'text-white',
              list: 'overflow-x-scroll min-h-fit overflow-y-hidden',
              trigger: 'min-w-fit mr-2 data-[state=active]:bg-primary/10 rounded-none inset-shadow-sm'
            }"
        >
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
                  class="cursor-pointer"
                  @click="openPreview({ name: gift.label, thumbnail_url: gift.thumbnail_url })"
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

          <!-- Entries Tab -->
          <template #entries>
            <!-- Empty State -->
            <div v-if="entriesProps.items.value.length === 0 && !entriesProps.loading.value" class="py-8 text-center text-muted">
              <Icon name="i-lucide-door-open" class="size-10 mx-auto mb-2 opacity-50" />
              <p>No entries yet</p>
            </div>

            <!-- Entries Grid -->
            <div v-else class="grid grid-cols-4 gap-2 mt-4">
              <ProfileHistoryCard
                  v-for="entry in entriesProps.items.value"
                  :key="`entry-${entry.id}`"
                  :badge-src="entry.thumbnail_url ?? undefined"
                  :item-name="entry.name"
                  class="cursor-pointer"
                  @click="openPreview(entry)"
              />
            </div>

            <!-- Loading More Indicator -->
            <div v-if="entriesProps.loading.value" class="py-4 text-center">
              <UButton loading variant="ghost" disabled>Loading more...</UButton>
            </div>
          </template>

          <!-- Frames Tab -->
          <template #frames>
            <!-- Empty State -->
            <div v-if="framesProps.items.value.length === 0 && !framesProps.loading.value" class="py-8 text-center text-muted">
              <Icon name="i-lucide-frame" class="size-10 mx-auto mb-2 opacity-50" />
              <p>No frames yet</p>
            </div>

            <!-- Frames Grid -->
            <div v-else class="grid grid-cols-4 gap-2 mt-4">
              <ProfileHistoryCard
                  v-for="frame in framesProps.items.value"
                  :key="`frame-${frame.id}`"
                  :badge-src="frame.thumbnail_url ?? undefined"
                  :item-name="frame.name"
                  class="cursor-pointer"
                  @click="openPreview(frame)"
              />
            </div>

            <!-- Loading More Indicator -->
            <div v-if="framesProps.loading.value" class="py-4 text-center">
              <UButton loading variant="ghost" disabled>Loading more...</UButton>
            </div>
          </template>

          <!-- Badges Tab -->
          <template #badges>
            <!-- Empty State -->
            <div v-if="profileBadges.items.value.length === 0 && !profileBadges.loading.value" class="py-8 text-center text-muted">
              <Icon name="i-lucide-award" class="size-10 mx-auto mb-2 opacity-50" />
              <p>No badges yet</p>
            </div>

            <!-- Badges Grid -->
            <div v-else class="grid grid-cols-4 gap-2 mt-4">
              <ProfileHistoryCard
                  v-for="badge in profileBadges.items.value"
                  :key="`badge-${badge.id}`"
                  :badge-src="badge.image_url"
                  :item-name="badge.name"
                  class="cursor-pointer"
                  @click="openPreview({ name: badge.name, asset_url: badge.asset_url, thumbnail_url: badge.image_url })"
              />
            </div>

            <!-- Loading Indicator -->
            <div v-if="profileBadges.loading.value" class="py-4 text-center">
              <UButton loading variant="ghost" disabled>Loading...</UButton>
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
        <UserTrackButton :user-id="profileId" :name="profileWritable?.name" />

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

        <!-- `profileId` is null until the profile resolves; interpolating it then
             produced the literal string "null" in the query (`/inbox?start=null`),
             which /inbox forwarded to POST /inbox/start/null → 500 (PHP-LARAVEL-7T). -->
        <UButton v-if="profileId" :to="`/inbox?start=${profileId}`" icon="i-lucide-message-circle-more" variant="subtle" size="md" class="pl-1 pr-2 gap-1 backdrop-blur-xs">
          Chat
        </UButton>

        <UButton
          icon="i-lucide-flag"
          variant="soft"
          size="md"
          color="warning"
          class="backdrop-blur-xs"
          @click="() => { showReportModal = true }"
        />
      </div>
    </footer>

    <!-- Cover / Avatar Image Preview -->
    <ImagePreviewModal
      :src="imagePreviewSrc"
      :open="imagePreviewOpen"
      :variant="imagePreviewType"
      :editable="isOwnProfile"
      :uploading="isUploading"
      :progress="progress"
      @close="imagePreviewOpen = false"
      @file-selected="handlePreviewFileSelected"
    />

    <!-- Prop / Gift Preview Modal -->
    <PropPreviewModal
      :item="previewItem"
      :open="previewOpen"
      @close="previewOpen = false"
    />

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
