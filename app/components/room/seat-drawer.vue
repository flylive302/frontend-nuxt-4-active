<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoomAudio } from '~/composables/useRoomAudio'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { takeSeat, leaveSeat, startAudio, stopAudio, muteUser, unmuteUser, lockSeat, unlockSeat } = useRoomAudio()

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
    console.error('[SeatDrawer] Failed to take seat:', error)
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
    console.error('[SeatDrawer] Failed to leave seat:', error)
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
    console.error('[SeatDrawer] Failed to toggle mute:', error)
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
    console.error('[SeatDrawer] Failed to toggle lock:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <UDrawer v-model:open="isOpen">
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-2 pb-4">
        <!-- Take Seat / Move to Seat button - only show if seat is empty (not locked) or user wants to move -->
        <UButton
v-if="(isSeatEmpty && !isSeatLocked) || isUserSeatedElsewhere"
          class="w-full justify-center rounded-none" size="xl" variant="subtle" color="primary" :loading="isLoading"
          icon="i-lucide-mic" @click="handleTakeSeat">
          {{ isUserSeatedElsewhere ? 'Move to Seat' : 'Take Seat' }} {{ seatId }}
        </UButton>

        <!-- Leave Seat button - only show if current user occupies this seat -->
        <UButton
v-if="isCurrentUserSeat" class="w-full justify-center rounded-none" size="xl" variant="subtle"
          color="error" :loading="isLoading" icon="i-lucide-mic-off" @click="handleLeaveSeat">
          Leave Seat {{ seatId }}
        </UButton>

<!--        <UButton v-if="isCurrentUserSeat && isProducing" class="w-full justify-center rounded-none" size="xl"-->
<!--          variant="subtle" color="warning" icon="i-lucide-volume-x" @click="stopAudio">-->
<!--          Stop Speaking-->
<!--        </UButton>-->

        <!-- Mute/Unmute Seat - Owner only, when seat is occupied -->
        <UButton
v-if="isRoomOwner && !isSeatEmpty && !isCurrentUserSeat" class="w-full justify-center rounded-none"
          size="xl" variant="subtle" :color="isSeatMuted ? 'success' : 'warning'" :loading="isLoading"
          :icon="isSeatMuted ? 'i-lucide-mic' : 'i-lucide-mic-off'" @click="handleToggleMute">
          {{ isSeatMuted ? 'Unmute' : 'Mute' }} Seat
        </UButton>


        <!-- Lock/Unlock Seat - Owner only -->
        <UButton
v-if="isRoomOwner" class="w-full justify-center rounded-none" size="xl" variant="subtle"
          :color="isSeatLocked ? 'success' : 'error'" :loading="isLoading"
          :icon="isSeatLocked ? 'i-lucide-lock-open' : 'i-lucide-lock'" @click="handleToggleLock">
          {{ isSeatLocked ? 'Unlock' : 'Lock' }} Seat
        </UButton>

        <!-- Invite User to Seat - Owner only, when seat is empty and not locked -->
        <UButton
v-if="isRoomOwner && isSeatEmpty && !isSeatLocked" class="w-full justify-center rounded-none" size="xl"
          variant="subtle" color="info" :loading="isLoading" icon="i-lucide-user-plus" @click="handleStartInvite">
          Invite User to Seat {{ seatId }}
        </UButton>

        <UButton
color="neutral" variant="subtle" icon="i-lucide-x"
          class="justify-center mt-2 shadow-md shadow-neutral-800" @click="isOpen = false">
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
