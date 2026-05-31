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
const authStore = useAuthStore()
const giftStore = useGiftStore()
const { takeSeat, leaveSeat, startAudio, muteUser, unmuteUser, lockSeat, unlockSeat, kickUser, isAudioReady } = useRoomAudio()
const { myMembership } = useRoomMembers()
const { resolvePropAsset } = usePropLookup()

const isLoading = ref(false)
const showMicDialog = ref(false)

// Separate drawer open state from activeSeat (keep seat selected when drawer closes)
const isOpen = ref(false)

// Watch activeSeat to open drawer when seat is clicked
watch(() => seatsStore.activeSeat, (newSeat) => {
  isOpen.value = newSeat !== null
})

// activeSeat is the 0-indexed seat index, or null when no seat is selected
const seatIndex = computed(() => seatsStore.activeSeat)

// Get current seat data (null when no seat is selected)
const currentSeat = computed(() =>
  seatIndex.value !== null ? seatsStore.seatsWithUsers[seatIndex.value] : null
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

  // Check mic permission state — show rationale dialog before the browser prompt fires
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    if (result.state === 'prompt') {
      showMicDialog.value = true
      return
    }
  } catch {
    // permissions API not supported — proceed directly
  }

  await doTakeSeat()
}

async function handleMicPermissionConfirmed() {
  await doTakeSeat()
}

async function doTakeSeat() {
  if (seatIndex.value === null) return

  isLoading.value = true
  try {
    const success = await takeSeat(seatIndex.value)
    if (success) {
      await startAudio()
      seatsStore.closeSeat()
    }
  } catch (error) {
    // Reset activeSeat so the watcher doesn't re-open the drawer on next interaction.
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
  } finally {
    isLoading.value = false
  }
}

const { isToggling, statusLoaded, isSelf, buttonIcon, toggleFollow } = useFollow(
  computed(() => currentSeat.value?.user?.id ?? null)
)

function handleGiftButton() {
  const userId = currentSeat.value?.user?.id
  if (!userId) return
  isOpen.value = false
  giftStore.setLockedRecipient(userId)
}

/** Current user can manage members (owner or admin) */
const canManageMembers = computed(() => {
  // Owner can always manage
  if (isRoomOwner.value) return true
  // Admin members can also manage
  if (myMembership.value?.role === 'admin') return true
  return false
})

/**
 * Get wealth level info from user's XP.
 */
const wealthLevel = computed(() =>
    getLevelFromXp(currentSeat.value?.user?.wealth_xp ?? '0', 'wealth')
)

/**
 * Get charm level info from user's XP.
 */
const charmLevel = computed(() =>
    getLevelFromXp(currentSeat.value?.user?.charm_xp ?? '0', 'charm')
)

// Data card background asset — only shown when user has a data_card_id equipped
const dataCardAsset = computed(() =>
  resolvePropAsset(currentSeat.value?.user?.data_card_id) ?? null
)

const isVap = computed(() => dataCardAsset.value?.endsWith('.mp4') ?? false)

// For own seat: read directly from auth store so the value is always fresh.
// For other seats: use whatever the participant map has (country is not PII-stripped).
const seatUserCountry = computed(() => {
  if (!currentSeat.value?.user) return null
  if (isCurrentUserSeat.value) return authStore.user?.country?.trim() || currentSeat.value.user.country?.trim() || null
  return currentSeat.value.user.country?.trim() || null
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
      content: 'bg-transparent backdrop-blur-xs',
      overlay: 'bg-white/10',
      handle: 'border-4 border-primary',
    }"
  >
    <template #content>
      <!-- Background Animation -->
      <div v-if="dataCardAsset" class="absolute z-0 overflow-hidden">
        <SvgaPlayer
            v-if="!isVap"
            :key="`data-card-svga-${currentSeat?.user?.data_card_id}`"
            :name="dataCardAsset"
            class="pointer-events-none -mt-28"
        />
        <VapPlayer
            v-else
            :key="`data-card-vap-${currentSeat?.user?.data_card_id}`"
            :name="dataCardAsset"
            class="pointer-events-none -mt-28"
        />
      </div>
      
      <div class="relative z-10 px-3" :class="dataCardAsset ? 'mt-32' : 'my-8'">

        <div v-if="currentSeat?.user" class="flex flex-col justify-center items-center relative z-10">
          <LazyUserAvatar
            :img="currentSeat.user.avatar ?? undefined"
            :frame-asset-url="resolvePropAsset(currentSeat.user.frame_id) ?? undefined"
            :animated="true" class="size-32 mt-6"
            @click="async () => {
              try {
                isOpen = false;
                roomStore.isMinimized = true;
                await navigateTo(`/profile/${currentSeat?.user?.signature}`);
              } catch (error) {}
            }"
          />

        <div class="flex gap-1 mt-4">
          <UIcon
            v-if="seatUserCountry"
            :name="`i-flag-${seatUserCountry.toLowerCase()}-4x3`"
            class="rounded overflow-hidden h-6 size-8 shadow-lg"
          />
          <MarqueeName
              class="flex-1 max-w-36 mx-auto"
              text-class="text-xl font-bold leading-none"
              :name="currentSeat.user.name"
              delay="0s"
          />
          <div>
            <UBadge
                color="secondary"
                :icon="getGenderInfo(currentSeat.user.gender).icon"
                size="sm"
                class="w-fit text-white p-1"
            >
              {{ seatUserAge }}
            </UBadge>
          </div>
        </div>
        <div class="flex items-center gap-1 mt-2 justify-center">

          <ProfileBadge v-if="currentSeat.user.signature" :show-badge="false" :txt="currentSeat.user.signature" />
          <img
              v-if="currentSeat.user.vip_level"
              :src="`https://ik.imagekit.io/flylive/vip/${currentSeat.user.vip_level}/badge.png`"
              class="w-14"
              alt=""
          >
          <img alt="" v-if="wealthLevel.badge" :src="wealthLevel.badge.image_url" class="h-8"/>
          <img alt="" v-if="charmLevel.badge" :src="charmLevel.badge.image_url" class="h-5"/>
        </div>

        <div class="flex items-center gap-1 justify-center">

        </div>

        </div>

        <!-- Action Buttons -->
        <div class="flex justify-center gap-2 mt-16">
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

          <div v-if="!isSeatEmpty && !isCurrentUserSeat" class="flex gap-2">
            <!-- Gift button -->
            <UButton
              class="rounded-xl p-0 m-0"
              size="xl"
              variant="ghost"
              square
              @click="handleGiftButton"
            >
              <img :src="ASSETS.GIFT_DRAWER_ICON" alt="gift" class="size-10" />
            </UButton>

            <!-- Follow button -->
            <UButton
              v-if="!isSelf"
              class="rounded-xl text-white"
              size="xl"
              variant="solid"
              square
              :loading="!statusLoaded || isToggling"
              :icon="buttonIcon"
              @click="toggleFollow"
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

      </div>
    </template>
  </UDrawer>
</template>
