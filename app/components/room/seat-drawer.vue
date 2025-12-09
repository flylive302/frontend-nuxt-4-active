<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoomAudio } from '~/composables/useRoomAudio'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { takeSeat, leaveSeat, startAudio, stopAudio, isProducing } = useRoomAudio()

const isLoading = ref(false)

const isOpen = computed({
  get: () => roomStore.activeSeat !== null,
  set: (value) => {
    if (!value) roomStore.closeSeat()
  }
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

// Check if current user is already seated somewhere else
const currentUserSeatIndex = computed(() => {
  return roomStore.seats.findIndex(seat => seat.user?.id === authStore.user?.id)
})

const isUserSeatedElsewhere = computed(() => {
  const idx = currentUserSeatIndex.value
  return idx !== -1 && idx !== seatIndex.value
})

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
</script>

<template>
  <UDrawer v-model:open="isOpen">
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-2 pb-4">
        <!-- Take Seat / Move to Seat button - only show if seat is empty or user wants to move -->
        <UButton
            v-if="isSeatEmpty || isUserSeatedElsewhere"
            class="w-full justify-center rounded-none"
            size="xl" 
            variant="subtle" 
            color="primary"
            :loading="isLoading"
            icon="i-lucide-mic"
            @click="handleTakeSeat"
        >
          {{ isUserSeatedElsewhere ? 'Move to Seat' : 'Take Seat' }} {{ seatId }}
        </UButton>

        <!-- Leave Seat button - only show if current user occupies this seat -->
        <UButton
            v-if="isCurrentUserSeat"
            class="w-full justify-center rounded-none"
            size="xl" 
            variant="subtle" 
            color="error"
            :loading="isLoading"
            icon="i-lucide-mic-off"
            @click="handleLeaveSeat"
        >
          Leave Seat {{ seatId }}
        </UButton>

        <!-- Stop Speaking button - only show if user is speaking -->
        <UButton
            v-if="isCurrentUserSeat && isProducing"
            class="w-full justify-center rounded-none"
            size="xl" 
            variant="subtle" 
            color="warning"
            icon="i-lucide-volume-x"
            @click="stopAudio"
        >
          Stop Speaking
        </UButton>

        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Invite to Seat
        </UButton>
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Mute Seat
        </UButton>
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Lock Seat
        </UButton>
        <UButton color="neutral" variant="subtle" icon="i-lucide-x" class="justify-center mt-2 shadow-md shadow-neutral-800" @click="isOpen = false">
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
