<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import type { ProfileImageType } from '~/composables/auth/useProfileImageUpload'
// ========================================
// Imports & Types
// ========================================

import {computed, onMounted} from 'vue'
import MarqueeName from "~/components/common/marquee-name.vue";

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'profile',
  middleware: 'auth',
  // Transitions are global (nuxt.config `app.viewTransition: true`). The home⇄
  // profile footer-avatar morph is activated per-nav by profile-transition.global.ts
  // (rides on top of the generic directional root slide) — see main.css.
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const authStore = useAuthStore()
const agencyStore = useAgencyStore()
const badgesStore = useBadgesStore()
const { getBadgeFromXp } = useLevelLookup()
const { fetchUserAgency } = useAgencyMembership()
const { fetchReceivedInvitations } = useAgencyInvitations()
const { fetchMyJoinRequests } = useAgencyJoinRequests()
const { resolvePropAsset } = usePropLookup()
const { syncUser } = useUserSync()

const CURRENT_WEALTH_BADGE = computed(() => getBadgeFromXp(authStore.user?.wealth_xp, 'wealth'))
const CURRENT_CHARM_BADGE = computed(() => getBadgeFromXp(authStore.user?.charm_xp, 'charm'))

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchUserAgency()
  fetchReceivedInvitations()
  fetchMyJoinRequests()
  // profile_visits has no realtime event and is only server-known (incremented
  // when others view us). Re-sync the auth user so the stats reflect visits that
  // landed since bootstrap. Fire-and-forget: the stale value renders instantly
  // and snaps to fresh when this resolves (also self-heals balance/xp/badges).
  void syncUser()
})

const dataCardAsset = computed(() =>
    resolvePropAsset(authStore.user?.data_card_id) ?? null
)

const isVap = computed(() => dataCardAsset.value?.endsWith('.mp4') ?? false)

const vip = authStore.user?.vip_level;

// ========================================
// Image Preview (cover / avatar)
// ========================================

const imagePreviewType = ref<ProfileImageType>('avatar')
const imagePreviewOpen = ref(false)
const { isUploading, progress, uploadProfileImage } = useProfileImageUpload()

// Reactive so the preview refreshes in place after a successful upload
const imagePreviewSrc = computed<string>(() =>
  imagePreviewType.value === 'avatar'
    ? authStore.user?.avatar ?? ASSETS.AVATAR_PLACEHOLDER
    : authStore.user?.cover_image ?? ASSETS.PROFILE_COVER_PLACEHOLDER
)

function openImagePreview(type: ProfileImageType): void {
  imagePreviewType.value = type
  imagePreviewOpen.value = true
}

async function handlePreviewFileSelected(file: File): Promise<void> {
  await uploadProfileImage(imagePreviewType.value, file)
}
</script>

<template>
  <div>
    <ProfileHeader>
      <template #cover>
        <NuxtImg
          :src="authStore.user?.cover_image ?? ASSETS.PROFILE_COVER_PLACEHOLDER"
          format="webp"
          densities="x1 x2"
          sizes="320px"
          width="100%"
          class="min-w-full aspect-rectangle object-cover h-48 animate-[zoom_15s_ease-in-out_infinite] cursor-pointer"
          @click="openImagePreview('cover')"
        />
      </template>

      <template #card>
        <div v-if="dataCardAsset" class="absolute z-0 overflow-hidden -mt-26">
          <SvgaPlayer
              v-if="!isVap"
              :key="`data-card-svga-${authStore?.user?.data_card_id}`"
              :name="dataCardAsset"
              class="pointer-events-none mt-[-24vw]"
          />
          <VapPlayer
              v-else
              :key="`data-card-vap-${authStore?.user?.data_card_id}`"
              :name="dataCardAsset"
              class="pointer-events-none mt-[-24vw]"
          />
        </div>
      </template>

      <template #signature-badges>
        <div class="w-full flex justify-end items-center gap-1" :class="dataCardAsset ? 'pt-10' : 'pt-2'">
          <ProfileBadge :vip="authStore?.user?.vip_level" :txt="authStore?.user?.signature || undefined" class="w-8/12" />
          <img v-if="vip" :src="`https://ik.imagekit.io/flylive/vip/${vip}/badge.${vip > 2 ? 'png' : 'webp'}`" class="w-4/12" alt="">
        </div>
      </template>

      <template #avatar>
        <div class="mt-[-12vw] w-9/12 cursor-pointer" @click="openImagePreview('avatar')">
          <UserAvatar
            :animated="true"
            :frame-asset-url="resolvePropAsset(authStore?.user?.frame_id) ?? undefined"
            :img="authStore.user?.avatar ?? ASSETS.AVATAR_PLACEHOLDER"
            :img-width="PROFILE_HEADER_AVATAR_WIDTH"
            class="w-full profile-avatar-anchor"
          />
        </div>
      </template>

      <template #badges>
        <div class="flex justify-start items-center w-full relative z-10" :class="dataCardAsset ? 'pt-10' : 'pt-2'">
          <img :src="CURRENT_WEALTH_BADGE" alt="current badge" class="w-7/12" >
          <img :src="CURRENT_CHARM_BADGE" alt="current badge" class="w-5/12" >
        </div>
      </template>

      <template #marquee>
        <BadgesEquippedBadgeMarquee :equipped-badges="badgesStore.equippedBadges" class="mx-auto max-w-28" />
      </template>

      <template #name>
        <NuxtLink :to="`/profile/${authStore.user?.signature}`">
          <MarqueeName
              class="mx-auto max-w-36"
              text-class="text-lg leading-none font-bold"
              :name="authStore.user?.name || ''"
              :vip="authStore.user?.vip_level"
          />
        </NuxtLink>
      </template>

      <template #stats>
        <div class="rounded-xl glowing-border overflow-hidden relative z-10 my-2" :class="dataCardAsset ? 'mx-6' : 'mx-4'">
          <UserStats
              class="mt-2"
              :wealth-xp="authStore.user?.wealth_xp ?? '0'"
              :charm-xp="authStore.user?.charm_xp ?? '0'"
              :followers="String(authStore.user?.followers_count ?? 0)"
              :following="String(authStore.user?.following_count ?? 0)"
              :visits="String(authStore.user?.profile_visits ?? 0)"
              :user-id="authStore.user?.id ?? null"
              :is-follow-list-public="true"
              :is-own-profile="true"
          />
        </div>
      </template>
    </ProfileHeader>

    <div class="pb-24 relative z-10 overflow-scroll h-[64vh]" :class="dataCardAsset ? 'px-[8vw]' : 'px-6'">
      <SectionTitle>Cp RelationShips</SectionTitle>
      <EventsProfileCard class="mb-4" />


      <NavProfileItem to="/coins/request" icon="i-lucide-coins" txt="Balance" />
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
      <NavProfileItem v-if="agencyStore.isAgencyMember" to="/agency/my-income" icon="i-lucide-dollar-sign" txt="My Agency Income" />

      <!-- Agency Invitations (visible if not agency member) -->
      <NavProfileItem v-if="!agencyStore.isAgencyMember" to="/agency/invitations" icon="i-lucide-mail" txt="Agency Invitations" :badge="agencyStore.receivedInvitations.items.length || undefined" />

      <!-- My Join Requests (visible if not agency member) -->
      <NavProfileItem v-if="!agencyStore.isAgencyMember" to="/agency/my-requests" icon="i-lucide-user-plus" txt="My Join Requests" :badge="agencyStore.myJoinRequests.items.filter(r => r.status === 'pending').length || undefined" />

      <!-- Create Agency (visible if not in agency) -->
      <NavProfileItem v-if="!agencyStore.isAgencyMember" to="/agency/create" icon="i-lucide-plus-circle" txt="Create Agency" />

    </div>

    <!-- Cover / Avatar Image Preview -->
    <ImagePreviewModal
      :src="imagePreviewSrc"
      :open="imagePreviewOpen"
      :variant="imagePreviewType"
      editable
      :uploading="isUploading"
      :progress="progress"
      @close="imagePreviewOpen = false"
      @file-selected="handlePreviewFileSelected"
    />
  </div>
</template>