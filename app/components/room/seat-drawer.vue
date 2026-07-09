<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoomAudio } from '~/composables/room/useRoomAudio'
import { createLogger } from '~/utils/logger'
import MarqueeName from "~/components/common/marquee-name.vue";
import { ASSETS } from '~/constants/assets'

const log = createLogger('[SeatDrawer]')

const { getLevelFromXp } = useLevelLookup()
const roomStore = useRoomStore()
const seatsStore = useRoomSeatsStore()
const participantsStore = useRoomParticipantsStore()
const authStore = useAuthStore()
const giftStore = useGiftStore()
const { takeSeat, leaveSeat, startAudio, muteUser, unmuteUser, lockSeat, unlockSeat, kickUser, isAudioReady } = useRoomAudio()
const { myMembership } = useRoomMembers()
const { resolvePropAsset } = usePropLookup()
const { hasGrantedMic, markMicGranted, probeMicState, requestMicAccess } = useMicPermission()
const toast = useToast()

const isLoading = ref(false)
const showMicDialog = ref(false)

// Separate drawer open state from activeSeat (keep seat selected when drawer closes)
const isOpen = ref(false)

// The drawer serves two mutually-exclusive modes: seat management (activeSeat)
// and view-only profile (profileUserId, e.g. tapping an avatar in chat). Open
// when either is set.
watch(
  () => seatsStore.activeSeat !== null || seatsStore.profileUserId !== null,
  (shouldOpen) => {
    isOpen.value = shouldOpen
  },
)

// Profile-only mode: no seat/social actions, just the profile card + visit-profile.
const isProfileMode = computed(() => seatsStore.profileUserId !== null)

// The participant being viewed in profile mode (null if they've left the room).
const profileUser = computed(() =>
  seatsStore.profileUserId !== null
    ? (participantsStore.participants.get(seatsStore.profileUserId) ?? null)
    : null,
)

// activeSeat is the 0-indexed seat index, or null when no seat is selected
const seatIndex = computed(() => seatsStore.activeSeat)

// Get current seat data (null when no seat is selected)
const currentSeat = computed(() =>
  seatIndex.value !== null ? seatsStore.seatsWithUsers[seatIndex.value] : null
)

// The user whose profile card is shown — the participant in profile mode,
// otherwise the seat occupant. One template serves both modes.
const displayUser = computed(() =>
  isProfileMode.value ? profileUser.value : (currentSeat.value?.user ?? null),
)

// Check if the current user occupies this seat
const isCurrentUserSeat = computed(() => {
  return currentSeat.value?.user?.id === authStore.user?.id
})

// Check if the seat is empty
const isSeatEmpty = computed(() => !currentSeat.value?.user)

// Check if seat is muted
const isSeatMuted = computed(() => currentSeat.value?.isMuted ?? false)

// Check if seat is locked
const isSeatLocked = computed(() => currentSeat.value?.isLocked ?? false)

// Check if current user is room owner
const { isRoomOwner } = useRoomPermissions()

// Handle starting invite mode
function handleStartInvite() {
  if (seatIndex.value === null) return
  seatsStore.startInviteMode(seatIndex.value)
  isOpen.value = false // Explicitly close drawer
}

/**
 * Take a seat. If the user already occupies another seat, the server's
 * Lua TAKE_SEAT_SCRIPT atomically moves them — we never call leaveSeat
 * first, which would leave the user briefly seatless and risk total
 * loss if the take then races and fails.
 */
async function handleTakeSeat() {
  if (seatIndex.value === null) return

  // Close the drawer before any permission flow so the explanatory dialog
  // and the browser's native permission prompt aren't visually blocked.
  isOpen.value = false

  // GATE: mic permission. Once granted on this device we NEVER show the
  // rationale again — getUserMedia is silent when the grant already exists, so
  // we take the seat directly. This avoids the dialog reappearing on every
  // take/switch (the Permissions API keeps reporting 'prompt' in the WebView).
  if (hasGrantedMic()) {
    await doTakeSeat()
    return
  }

  const state = await probeMicState()
  if (state === 'granted') {
    await doTakeSeat()
    return
  }
  if (state === 'denied') {
    notifyMicBlocked()
    return
  }

  // 'prompt' or 'unknown' → explain before the native prompt fires.
  showMicDialog.value = true
}

async function handleMicPermissionConfirmed() {
  const result = await requestMicAccess()
  if (result === 'denied') {
    notifyMicBlocked()
    return
  }
  // 'granted' (flag now set) or 'unavailable' (best-effort) → proceed; the
  // seat's own getUserMedia is the final arbiter.
  await doTakeSeat()
}

function notifyMicBlocked() {
  toast.add({
    title: 'Microphone blocked',
    description: 'Enable microphone access for FlyLive in your device settings to speak on a seat.',
    color: 'warning',
  })
}

async function doTakeSeat() {
  if (seatIndex.value === null) return

  isLoading.value = true
  try {
    const success = await takeSeat(seatIndex.value)
    if (success) {
      await startAudio()
      // startAudio's getUserMedia succeeded → the grant is real and persistent.
      markMicGranted()
      seatsStore.closeSeat()
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      notifyMicBlocked()
    } else {
      log.warn('Failed to take seat', error)
    }
    seatsStore.closeSeat()
  } finally {
    isLoading.value = false
  }
}

async function handleLeaveSeat() {
  isLoading.value = true
  try {
    // leaveSeat() in useSeatActions already calls stopAudio()
    const success = await leaveSeat()
    if (success) {
      seatsStore.closeSeat()
    }
  } catch (error) {
    log.warn('Failed to leave seat', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle mute/unmute toggle (owner only)
 */
async function handleToggleMute() {
  const userId = currentSeat.value?.user?.id
  if (!userId) return

  isLoading.value = true
  try {
    if (isSeatMuted.value) {
      await unmuteUser(userId)
    } else {
      await muteUser(userId)
    }
  } catch (error) {
    log.warn('Failed to toggle mute for seat', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle lock/unlock toggle (owner only)
 */
async function handleToggleLock() {
  if (seatIndex.value === null) return
  isLoading.value = true
  try {
    if (isSeatLocked.value) {
      await unlockSeat(seatIndex.value)
    } else {
      await lockSeat(seatIndex.value)
    }
    seatsStore.closeSeat()
  } catch (error) {
    log.warn('Failed to toggle lock for seat', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle kicking a user from the room (admin/owner only)
 */
async function handleKickUser() {
  const userId = currentSeat.value?.user?.id
  if (!userId) return

  isLoading.value = true
  try {
    const success = await kickUser(userId)
    if (success) {
      seatsStore.closeSeat()
    }
  } catch (error) {
    log.warn('Failed to kick user from seat', error)
  } finally {
    isLoading.value = false
  }
}

const { isToggling, statusLoaded, isSelf, buttonIcon, toggleFollow, buttonLabel } = useFollow(
  computed(() => currentSeat.value?.user?.id ?? null)
)

function handleGiftButton() {
  const userId = currentSeat.value?.user?.id
  if (!userId) return
  isOpen.value = false
  giftStore.setLockedRecipient(userId)
}

async function handleNavigateAway(path: string) {
  isOpen.value = false
  roomStore.minimizeRoom()
  await navigateTo(path)
}

/** Visit the shown user's profile (avatar tap) — works in both modes. */
function handleVisitProfile() {
  const signature = displayUser.value?.signature
  if (!signature) return
  handleNavigateAway(`/profile/${signature}`)
}

/** Current user can manage members (owner or admin) */
const canManageMembers = computed(() => {
  // Owner can always manage
  if (isRoomOwner.value) return true
  // Admin members can also manage
  return myMembership.value?.role === 'admin';
})

/**
 * Get wealth level info from user's XP.
 */
const wealthLevel = computed(() =>
    getLevelFromXp(displayUser.value?.wealth_xp ?? '0', 'wealth')
)

/**
 * Get charm level info from user's XP.
 */
const charmLevel = computed(() =>
    getLevelFromXp(displayUser.value?.charm_xp ?? '0', 'charm')
)

// Data card background asset — only shown when user has a data_card_id equipped
const dataCardAsset = computed(() =>
  resolvePropAsset(displayUser.value?.data_card_id) ?? null
)

const isVap = computed(() => dataCardAsset.value?.endsWith('.mp4') ?? false)

// For own seat: read directly from auth store so the value is always fresh.
// For other seats: use whatever the participant map has (country is not PII-stripped).
const seatUserCountry = computed(() => {
  if (!displayUser.value) return null
  if (isCurrentUserSeat.value) return authStore.user?.country?.trim() || displayUser.value.country?.trim() || null
  return displayUser.value.country?.trim() || null
})

// Age is only available for the authenticated user's own seat — date_of_birth is
// stripped from other participants' data for privacy.
const seatUserAge = computed(() =>
  isCurrentUserSeat.value ? getAge(authStore.user?.date_of_birth ?? null) : null
)
</script>

<template>
  <RoomMicPermissionDialog
    v-model:open="showMicDialog"
    @confirm="handleMicPermissionConfirmed"
  />

  <UDrawer
    v-model:open="isOpen" 
    title="Seat Options" 
    :class="dataCardAsset ? 'min-h-9/12' : ''"
    description="Manage seat actions like joining, leaving, muting, or locking."
    :ui="{
      content: 'bg-transparent backdrop-blur-xs ring-0',
      overlay: 'bg-white/10',
      handle: 'border-4 border-primary',
    }"
  >
    <template #content>
      <!-- Background Animation -->
      <div v-if="dataCardAsset" class="absolute z-0 overflow-hidden">
        <SvgaPlayer
            v-if="!isVap"
            :key="`data-card-svga-${displayUser?.data_card_id}`"
            :name="dataCardAsset"
            class="pointer-events-none -mt-28"
        />
        <VapPlayer
            v-else
            :key="`data-card-vap-${displayUser?.data_card_id}`"
            :name="dataCardAsset"
            class="pointer-events-none -mt-28"
        />
      </div>
      
      <div class="relative z-10 px-3" :class="dataCardAsset ? 'mt-32' : 'my-8'">

        <div v-if="displayUser" class="flex flex-col justify-center items-center relative z-10">
          <LazyUserAvatar
            :img="displayUser.avatar ?? undefined"
            :frame-asset-url="resolvePropAsset(displayUser.frame_id) ?? undefined"
            :animated="true" class="size-32"
            @click="handleVisitProfile"
            />

          <div class="flex gap-1">
            <UIcon
              v-if="seatUserCountry"
              :name="`i-flag-${seatUserCountry.toLowerCase()}-4x3`"
              class="rounded overflow-hidden h-6 size-8 shadow-lg"
            />
            <MarqueeName
                class="flex-1 max-w-36 mx-auto"
                text-class="text-xl font-bold leading-none"
                :name="displayUser.name"
                delay="0s"
            />
              <UBadge
                  color="secondary"
                  :icon="getGenderInfo(displayUser.gender).icon"
                  size="sm"
                  class="w-fit text-white p-1"
              >
                {{ seatUserAge }}
              </UBadge>
          </div>
          <div class="flex items-center gap-1 justify-center">

            <ProfileBadge
                v-if="displayUser.signature"
                :vip="displayUser.vip_level"
                :txt="displayUser.signature"
                class="max-w-24"
            />
            <img
                v-if="displayUser.vip_level"
                :src="`https://ik.imagekit.io/flylive/vip/${displayUser.vip_level}/badge.png`"
                class="w-14"
                alt=""
            >
            <img v-if="wealthLevel.badge" alt="" :src="wealthLevel.badge.image_url" class="h-8">
            <img v-if="charmLevel.badge" alt="" :src="charmLevel.badge.image_url" class="h-5">
          </div>

          <BadgesEquippedBadgeMarquee
            :equipped-badges="displayUser.equipped_badges ?? []"
            class=""
          />

        </div>

        <!-- Action Buttons — seat/social actions are hidden in view-only profile mode -->
        <div v-if="!isProfileMode" class="mt-6 max-w-24 mx-auto">
          <div class="flex justify-center items-center gap-2 ">
            <div class="flex gap-2">
              <!-- Take Seat button — only when seat is empty and unlocked -->
              <UButton
                  v-if="(isSeatEmpty && !isSeatLocked)"
                  class="rounded-xl text-white"
                  size="xl" variant="solid" square color="success"
                  :loading="isLoading"
                  :disabled="!isAudioReady"
                  @click="handleTakeSeat"
              >
                <template v-if="!isAudioReady">(Loading...)</template>
                <UIcon v-else name="i-lucide-plane-takeoff" size="xl" class="size-6" />
              </UButton>

              <!-- Leave Seat button - only show if current user occupies this seat -->
              <UButton
                  v-if="isCurrentUserSeat"
                  class="rounded-xl text-white"
                  size="xl" variant="solid" square color="error"
                  :loading="isLoading" icon="i-lucide-plane-landing"
                  @click="handleLeaveSeat"
              />
            </div>

            <div v-if="canManageMembers" class="flex gap-2">
              <!-- Mute/Unmute Seat - Owner only, when seat is occupied -->
              <UButton
                  v-if="!isSeatEmpty && !isCurrentUserSeat"
                  class="rounded-xl text-white"
                  size="xl" variant="solid"
                  :color="isSeatMuted ? 'success' : 'warning'"
                  :loading="isLoading"
                  :icon="isSeatMuted ? 'i-lucide-mic' : 'i-lucide-mic-off'"
                  @click="handleToggleMute"
              />

              <!-- Lock/Unlock Seat - Owner only -->
              <UButton
                  class="rounded-xl text-white"
                  size="xl" variant="solid" square
                  :color="isSeatLocked ? 'success' : 'error'"
                  :loading="isLoading"
                  :icon="isSeatLocked ? 'i-lucide-lock-open' : 'i-lucide-lock'"
                  @click="handleToggleLock"
              />

              <!-- Invite User to Seat - Owner only, when seat is empty and not locked -->
              <UButton
                  v-if="isSeatEmpty"
                  class="rounded-xl text-white" size="xl"
                  variant="solid" color="info" :loading="isLoading"
                  square
                  icon="i-lucide-user-plus"
                  @click="handleStartInvite"
              />

              <!-- Kick User from Room - Admin/Owner only, when seat is occupied by another user -->
              <UButton
                  v-if="!isSeatEmpty && !isCurrentUserSeat"
                  class="rounded-xl text-white"
                  size="xl" variant="solid" square color="error"
                  :loading="isLoading"
                  icon="i-lucide-log-out"
                  @click="handleKickUser"
              />
            </div>
          </div>

          <div v-if="!isSeatEmpty && !isCurrentUserSeat" class="flex items-center gap-1 justify-center mt-3">
                        <!-- Follow button -->
            <UButton
                v-if="!isSelf"
                class="rounded-xl text-white backdrop-blur-lg"
                size="xl"
                variant="outline"
                :loading="!statusLoaded || isToggling"
                :icon="buttonIcon"
                @click="toggleFollow"
            >
              {{buttonLabel}}
            </UButton>

            <!-- Chat button -->
            <UButton
                v-if="!isSelf && !isSeatEmpty"
                class="rounded-xl text-white backdrop-blur-lg"
                size="xl"
                variant="outline"
                icon="i-lucide-message-circle-more"
                @click="handleNavigateAway(`/inbox?start=${currentSeat?.user?.id}`)"
            >
              Chat
            </UButton>

            <!-- Gift button -->
            <UButton
                v-if="!isSelf && !isSeatEmpty"
                class="rounded-xl text-white backdrop-blur-lg py-1"
                size="xl"
                variant="outline"
                @click="handleGiftButton"
            >
              <img :src="ASSETS.GIFT_DRAWER_ICON" alt="gift" class="min-w-8" >
            </UButton>

          </div>
        </div>

      </div>
    </template>
  </UDrawer>
</template>
