<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoomAudio } from '~/composables/room/useRoomAudio'
import { createLogger } from '~/utils/logger'

const log = createLogger('[SeatDrawer]')

const bootstrapStore = useBootstrapStore()
const roomStore = useRoomStore()
const authStore = useAuthStore()
const { takeSeat, leaveSeat, startAudio, stopAudio, muteUser, unmuteUser, lockSeat, unlockSeat, isAudioReady } = useRoomAudio()
const { myMembership } = useRoomMembers()

const isLoading = ref(false)

// Separate drawer open state from activeSeat (keep seat selected when drawer closes)
const isOpen = ref(false)

// Watch activeSeat to open drawer when seat is clicked
watch(() => roomStore.activeSeat, (newSeat) => {
  isOpen.value = newSeat !== null
})

// seatId is 1-indexed from the UI
const seatId = computed(() => roomStore.activeSeat)

// seatIndex is 0-indexed for the store/API
const seatIndex = computed(() => (seatId.value ?? 1) - 1)

// Get current seat data
const currentSeat = computed(() => roomStore.seats[seatIndex.value])

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
const isRoomOwner = computed(() => roomStore.isRoomOwner)

const isVip = computed(() => (currentSeat.value?.user?.vip_level ?? 0) > 0)

// Check if current user is already seated somewhere else
const currentUserSeatIndex = computed(() => {
  return roomStore.seats.findIndex(seat => seat.user?.id === authStore.user?.id)
})

const isUserSeatedElsewhere = computed(() => {
  const idx = currentUserSeatIndex.value
  return idx !== -1 && idx !== seatIndex.value
})


// Handle starting invite mode
function handleStartInvite() {
  roomStore.startInviteMode(seatIndex.value)
  isOpen.value = false // Explicitly close drawer
}

/**
 * Handle taking a seat and starting to speak
 */
async function handleTakeSeat() {
  if (!seatId.value) return

  isLoading.value = true
  try {
    // If user is seated elsewhere, leave that seat first
    if (isUserSeatedElsewhere.value) {
      await leaveSeat()
    }

    // Take the new seat
    const success = await takeSeat(seatIndex.value)

    if (success) {
      // Start audio so everyone can hear the user
      await startAudio()
      // Close the drawer
      roomStore.closeSeat()
    }
  } catch (error) {
    log.error('Failed to take seat:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle leaving the current seat
 */
async function handleLeaveSeat() {
  isLoading.value = true
  try {
    const success = await leaveSeat()
    if (success) {
      stopAudio()
      roomStore.closeSeat()
    }
  } catch (error) {
    log.error('Failed to leave seat:', error)
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
    log.error('Failed to toggle mute:', error)
  } finally {
    isLoading.value = false
  }
}

/**
 * Handle lock/unlock toggle (owner only)
 */
async function handleToggleLock() {
  isLoading.value = true
  try {
    if (isSeatLocked.value) {
      await unlockSeat(seatIndex.value)
    } else {
      await lockSeat(seatIndex.value)
    }
    roomStore.closeSeat()
  } catch (error) {
    log.error('Failed to toggle lock:', error)
  } finally {
    isLoading.value = false
  }
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
    bootstrapStore.getLevelFromXp(currentSeat.value?.user?.wealth_xp ?? '0', 'wealth')
)

/**
 * Get charm level info from user's XP.
 */
const charmLevel = computed(() =>
    bootstrapStore.getLevelFromXp(currentSeat.value?.user?.charm_xp ?? '0', 'charm')
)
</script>

<template>
  <UDrawer 
    v-model:open="isOpen" 
    title="Seat Options" 
    :class="isVip ? 'min-h-9/12' : ''" 
    description="Manage seat actions like joining, leaving, muting, or locking."
    :ui="{
      content: 'bg-transparent backdrop-blur-xs',
      overlay: 'bg-white/10',
      handle: 'border-4 border-primary',
    }"
  >
    <template #content>
      <!-- Background Animation -->
      <div v-if="isVip" class="absolute z-0">
        <SvgaPlayer 
          :key="`vip-card-${currentSeat?.user?.vip_level}`" 
          :name="`https://assets.flyliveapp.com/vip/${currentSeat?.user?.vip_level}/card.svga`" 
          class="pointer-events-none -mt-28" />
      </div>
      
      <div class="relative z-10 px-3" :class="isVip ? 'mt-32' : 'my-8'">

        <div v-if="currentSeat?.user" class="flex flex-col justify-center items-center relative z-10">
          <LazyUserAvatar
            :img="currentSeat.user.avatar ?? undefined"
            :frame-asset-url="currentSeat.user.frame ?? undefined"
            :animated="true" class="size-32" 
            @click="async () => {
              try {
                isOpen = false;
                roomStore.minimizeRoom();
                navigateTo(`/profile/${currentSeat?.user?.signature}`);
              } catch (error) {
                log.error('Failed to navigate to profile:', error);
              }
            }"
          />

          <div class="text-center">
            <h3 class="text-xl font-bold">{{ currentSeat.user.name }}</h3>

            <div class="flex items-center gap-2 justify-center">
              <UBadge
                  color="secondary"
                  :icon="getGenderInfo(currentSeat.user.gender).icon"
                  size="sm"
                  class="w-fit text-white p-1"
              >
                {{ getAge(currentSeat.user.date_of_birth) }}
              </UBadge>
              <UIcon
                :name="`i-flag-${currentSeat.user.country?.toLowerCase()}-4x3`"
                class="rounded overflow-hidden h-6 size-8 shadow-lg"
              />
            </div>

            <div class="flex items-center gap-1 justify-center mt-1">
              <ProfileBadge v-if="currentSeat.user.signature" :show-badge="false" :txt="currentSeat.user.signature" />
              <ProfileBadge
              v-if="wealthLevel.badge"
              :badge-src="wealthLevel.badge.image_url"
              color="tertiary"
              :txt="String(wealthLevel.level)"
              />
              <ProfileBadge
              v-if="charmLevel.badge"
              :badge-src="charmLevel.badge.image_url"
              color="secondary"
              :txt="String(charmLevel.level)"
              />
            </div>
          
          </div>

        </div>

        <div class="flex justify-center gap-2 mt-12">
          <div class="flex gap-2">
            <!-- Take Seat / Move to Seat button - only show if seat is empty (not locked) or user wants to move -->
            <UButton
              v-if="(isSeatEmpty && !isSeatLocked)"
              class="rounded-xl text-white" 
              size="xl" variant="solid" square color="success" 
              :loading="isLoading"
              :disabled="!isAudioReady"
              @click="handleTakeSeat"
            >
              <!-- {{ isUserSeatedElsewhere ? 'Move to Seat' : 'Take Seat' }} {{ seatId }} -->
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
          </div>
        </div>
<!-- 
        <UButton
          color="neutral" variant="soft" icon="i-lucide-x"
          class="justify-center mt-2 w-full shadow-md shadow-neutral-800" 
          @click="isOpen = false"
        >
          Cancel
        </UButton> -->

      </div>
    </template>
  </UDrawer>
</template>
