<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoomAudio } from '~/composables/room/useRoomAudio'
import { useRoomBlocking } from '~/composables/room/useRoomBlocking'
import { createLogger } from '~/utils/logger'
import MarqueeName from "~/components/common/marquee-name.vue";
import KickDurationPopover from '~/components/room/kick-duration-popover.vue'
import { ASSETS, vipBadgeUIImg } from '~/constants/assets'
import type { BlockDurationValue } from '~/constants/room'
import { withImageKitTransform, levelBadgeSrc } from '~/utils/imagekit'

const log = createLogger('[SeatDrawer]')

const { getLevelFromXp } = useLevelLookup()
const roomStore = useRoomStore()
const roomSession = useRoomSession()
const seatsStore = useRoomSeatsStore()
const participantsStore = useRoomParticipantsStore()
const authStore = useAuthStore()
const giftStore = useGiftStore()
const { takeSeat, leaveSeat, startAudio, muteUser, unmuteUser, lockSeat, unlockSeat, inviteToSeat, isAudioReady } = useRoomAudio()
const { blockUser } = useRoomBlocking()
const { resolvePropAsset } = usePropLookup()
const { hasGrantedMic, markMicGranted, probeMicState, requestMicAccess } = useMicPermission()
const toast = useToast()

const isLoading = ref(false)
const showMicDialog = ref(false)
const isKickPopoverOpen = ref(false)

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

// Profile mode: opened from an avatar tap rather than a seat tap. It shows the
// same card, minus the seat-slot actions (there is no slot to act on).
const isProfileMode = computed(() => seatsStore.profileUserId !== null)

// The participant being viewed in profile mode (null if they've left the room).
const profileUser = computed(() =>
  seatsStore.profileUserId !== null
    ? (participantsStore.participants.get(seatsStore.profileUserId) ?? null)
    : null,
)

// UI-only: a profile-mode target who leaves mid-view is pruned from the
// participant map, leaving an empty card behind. Close instead of showing it.
watch(profileUser, (user) => {
  if (isProfileMode.value && !user) {
    isOpen.value = false
    seatsStore.closeProfile()
  }
})

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

// The target of every per-user action (follow / chat / gift / kick / invite).
// Drawn from displayUser so seat mode and profile mode share one identity.
const targetUserId = computed(() => displayUser.value?.id ?? null)

// Per-user action eligibility — target-state driven, never mode driven.
const { canManageMembers, freeSeatIndex, isSelfTarget, canFollow, canChat, canGift, canMute, canKick, canInviteToSeat } =
  useSeatDrawerActions(targetUserId)

// The seat the shown user occupies. In seat mode that's the tapped seat; in
// profile mode we resolve it from the target, so mute reads the right seat's
// state no matter which way the drawer was opened.
const targetSeat = computed(() =>
  isProfileMode.value
    ? (seatsStore.seatsWithUsers.find((s) => s.user?.id === targetUserId.value) ?? null)
    : (currentSeat.value ?? null),
)

// Check if the current user occupies this seat
const isCurrentUserSeat = computed(() => {
  return currentSeat.value?.user?.id === authStore.user?.id
})

// Check if the seat is empty
const isSeatEmpty = computed(() => !currentSeat.value?.user)

// Check if the target's seat is muted
const isSeatMuted = computed(() => targetSeat.value?.isMuted ?? false)

// Check if seat is locked
const isSeatLocked = computed(() => currentSeat.value?.isLocked ?? false)

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
 * Handle mute/unmute toggle (owner/admin only).
 *
 * Targets the user, not the slot, so it works for a seated user reached from a
 * chat avatar as well as from their seat.
 */
async function handleToggleMute() {
  const userId = targetUserId.value
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
 * Handle kicking a user from the room (admin/owner only).
 *
 * Unified kick path (ADR 0017): kicking IS blocking with a duration. There is
 * no duration-less kick — selecting a duration in the popover is the only
 * INTENT that reaches this handler. Ejection (seat clear, force-removal,
 * feedback) happens via the Laravel→MSAB member-removed fanout, not a
 * direct socket emit.
 */
async function handleKickUser(duration: BlockDurationValue) {
  const userId = targetUserId.value
  if (!userId) return

  isLoading.value = true
  try {
    const success = await blockUser(roomStore.currentRoom!.id, { user_id: userId, duration })
    if (success) {
      // Kick is reachable from both modes, so clear both — closeSeat alone
      // would leave a profile-mode drawer open on a user who is now gone.
      seatsStore.closeSeat()
      seatsStore.closeProfile()
    }
  } catch (error) {
    log.warn('Failed to kick user from seat', error)
  } finally {
    isLoading.value = false
  }
}

const { isFollowing, isToggling, statusLoaded, buttonIcon, toggleFollow } = useFollow(targetUserId)

// Shared follow celebration (styles live globally in assets/css/main.css)
const { followAnimating, burst } = useFollowBurst()

/** Follow / follow-back, plus the burst animation on a *new* follow only. */
async function handleFollowClick(): Promise<void> {
  const wasFollowing = isFollowing.value
  await toggleFollow()

  if (!wasFollowing && isFollowing.value) {
    burst()
  }
}

function handleChatButton() {
  const userId = targetUserId.value
  if (!userId) return
  isOpen.value = false
  seatsStore.openChat(userId)
}

function handleGiftButton() {
  const userId = targetUserId.value
  if (!userId) return
  isOpen.value = false
  giftStore.setLockedRecipient(userId)
}

/**
 * Invite the shown (non-seated) user onto the lowest free unlocked seat.
 *
 * Profile mode has no seat slot of its own, so it inverts the seat-first
 * invite flow (`startInviteMode` → pick a user) into user-first: the target is
 * already known, so we resolve the slot instead. `canInviteToSeat` guarantees
 * `freeSeatIndex` is non-null; the server is still the final arbiter and
 * surfaces its own error toast.
 */
async function handleInviteToSeat() {
  const userId = targetUserId.value
  const seat = freeSeatIndex.value
  if (!userId || seat === null) return

  isLoading.value = true
  try {
    const success = await inviteToSeat(userId, seat)
    if (success) {
      isOpen.value = false
      seatsStore.closeProfile()
    }
  } catch (error) {
    log.warn('Failed to invite user to seat', error)
  } finally {
    isLoading.value = false
  }
}

async function handleNavigateAway(path: string) {
  isOpen.value = false
  roomSession.minimizeRoom()
  await navigateTo(path)
}

/** Visit the shown user's profile (avatar tap) — works in both modes. */
function handleVisitProfile() {
  const signature = displayUser.value?.signature
  if (!signature) return
  handleNavigateAway(`/profile/${signature}`)
}

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

// For self: read directly from auth store so the value is always fresh.
// For others: use whatever the participant map has (country is not PII-stripped).
// Keyed off the target user, not the seat — profile mode can show self too.
const seatUserCountry = computed(() => {
  if (!displayUser.value) return null
  if (isSelfTarget.value) return authStore.user?.country?.trim() || displayUser.value.country?.trim() || null
  return displayUser.value.country?.trim() || null
})

// For self: read from the auth store so an just-edited DOB is reflected instantly.
// For others: date_of_birth ships in the participant payload (MinimalUserResource),
// so their age renders too.
// getGenderInfo returns a plain string; UBadge wants its own color union.
type BadgeColor = 'primary' | 'secondary' | 'tertiary' | 'neutral'

const genderInfo = computed(() => {
  const info = getGenderInfo(displayUser.value?.gender)
  return { icon: info.icon, color: info.color as BadgeColor }
})

const seatUserAge = computed(() => {
  if (!displayUser.value) return null
  const dob = isSelfTarget.value
    ? (authStore.user?.date_of_birth ?? displayUser.value.date_of_birth)
    : displayUser.value.date_of_birth
  return getAge(dob ?? null)
})
</script>

<template>
  <RoomMicPermissionDialog
    v-model:open="showMicDialog"
    @confirm="handleMicPermissionConfirmed"
  />

  <UDrawer
    v-model:open="isOpen"
    :title="isProfileMode ? 'User Options' : 'Seat Options'"
    :class="dataCardAsset ? 'min-h-9/12' : ''"
    :description="isProfileMode
      ? 'Follow, chat, gift, mute, invite to a seat, or remove this user.'
      : 'Manage seat actions like joining, leaving, muting, or locking.'"
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
      
      <div class="relative z-10 px-3" :class="dataCardAsset ? 'mt-44' : 'my-8'">

        <div v-if="displayUser" class="flex flex-col justify-center items-center relative z-10">
          <LazyUserAvatar
            :img="displayUser.avatar ?? undefined"
            :frame-id="displayUser.frame_id"
            :user-name="displayUser.name"
            :animated="true" class="size-32"
            @click="handleVisitProfile"
          />

          <div class="flex gap-1 mt-3">
            <CountryFlag
              v-if="seatUserCountry"
              :code="seatUserCountry"
              class="rounded overflow-hidden h-6 size-8 shadow-lg"
            />
            <MarqueeName
                class="flex-1 max-w-36 mx-auto"
                text-class="text-xl font-bold leading-none"
                :name="displayUser.name"
                delay="0s"
            />
              <UBadge
                  :color="genderInfo.color"
                  :icon="genderInfo.icon"
                  size="sm"
                  class="w-fit text-white p-1"
              >
                {{ seatUserAge }}
              </UBadge>
          </div>
          <div class="flex items-center gap-1 mt-2 justify-center">

            <ProfileBadge
                v-if="displayUser.signature"
                :vip="displayUser.vip_level"
                :txt="displayUser.signature"
                class="max-w-24"
            />
            <img
                v-if="displayUser.vip_level"
                :src="withImageKitTransform(vipBadgeUIImg(displayUser.vip_level), { h: 52 })"
                class="h-6.5 -mb-1"
                alt=""
            >
            <!-- Level badges are height-constrained and wide (aspect ~2.8-3.2), so they size by `h-`, not `w-` -->
            <img v-if="wealthLevel.badge" alt="" :src="levelBadgeSrc(wealthLevel.badge.image_url, 28)" class="h-7">
            <img v-if="charmLevel.badge" alt="" :src="levelBadgeSrc(charmLevel.badge.image_url, 20)" class="h-5">
          </div>

          <BadgesEquippedBadgeMarquee
            :equipped-badges="displayUser.equipped_badges ?? []"
            class="max-w-3/4"
          />

        </div>

        <div class="mt-4 mx-auto">
          <div class="flex justify-center items-center gap-2">
            <div v-if="!isProfileMode" class="flex gap-2">
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

            <!-- Seat mode always has the lock button; profile mode only shows
                 this row when the target actually qualifies for something. -->
            <div
              v-if="canManageMembers && (!isProfileMode || canMute || canKick || canInviteToSeat)"
              class="flex gap-2"
            >
              <!-- Mute/Unmute — targets the user, so it follows them into
                   profile mode as long as they're on a seat -->
              <UButton
                  v-if="canMute"
                  class="rounded-xl text-white"
                  size="xl" variant="solid"
                  :color="isSeatMuted ? 'success' : 'warning'"
                  :loading="isLoading"
                  :icon="isSeatMuted ? 'i-lucide-mic' : 'i-lucide-mic-off'"
                  @click="handleToggleMute"
              />

              <!-- Seat-slot moderation — needs the slot, so seat mode only -->
              <template v-if="!isProfileMode">
                <!-- Lock/Unlock Seat -->
                <UButton
                    class="rounded-xl text-white"
                    size="xl" variant="solid" square
                    :color="isSeatLocked ? 'success' : 'error'"
                    :loading="isLoading"
                    :icon="isSeatLocked ? 'i-lucide-lock-open' : 'i-lucide-lock'"
                    @click="handleToggleLock"
                />

                <!-- Pick a user for THIS seat, when it's empty -->
                <UButton
                    v-if="isSeatEmpty"
                    class="rounded-xl text-white" size="xl"
                    variant="solid" color="info" :loading="isLoading"
                    square
                    icon="i-lucide-user-plus"
                    @click="handleStartInvite"
                />
              </template>

              <!-- Invite THIS user onto a free seat — only when they're in the
                   room, not already seated, and a free seat exists -->
              <UButton
                  v-if="canInviteToSeat"
                  class="rounded-xl text-white" size="xl"
                  variant="solid" color="info" :loading="isLoading"
                  square
                  icon="i-lucide-user-plus"
                  @click="handleInviteToSeat"
              />

              <!-- Kick User from Room — needs room presence, not a seat -->
              <KickDurationPopover
                  v-if="canKick"
                  v-model:open="isKickPopoverOpen"
                  @select="handleKickUser"
              >
                <UButton
                    class="rounded-xl text-white"
                    size="xl" variant="solid" square color="error"
                    :loading="isLoading"
                    icon="i-lucide-log-out"
                />
              </KickDurationPopover>
            </div>
          </div>

          <div v-if="canFollow || canChat || canGift" class="gap-1 pl-4 flex items-center justify-center mt-2 w-full">

            <!-- Follow button — needs neither a seat nor room presence -->
            <UButton
                class="rounded-xl text-white follow-btn transition-all duration-150"
                :class="{
                  'follow-btn--animating': followAnimating,
                }"
                size="xl"
                :variant="isFollowing ? 'solid' : 'subtle'"
                :loading="!statusLoaded || isToggling"
                :icon="buttonIcon"
                @click="handleFollowClick"
            />

            <!-- Chat button — DM thread, works for any user -->
            <UButton
                class="rounded-xl"
                size="xl"
                variant="subtle"
                icon="i-lucide-message-circle-more"
                @click="handleChatButton"
            >
              Chat
            </UButton>

            <!-- Gift button — gift recipients resolve from occupied seats only -->
            <UButton
              class="rounded-xl p-0"
              size="xl"
              square
              variant="ghost"
              @click="handleGiftButton"
            >
              <img :src="ASSETS.GIFT_DRAWER_ICON" alt="gift" class="max-w-12 min-w-12" >
            </UButton>

          </div>
        </div>

      </div>
    </template>
  </UDrawer>
</template>
