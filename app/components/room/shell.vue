<script setup lang="ts">
/**
 * RoomShell - Main room container component
 * Integrates header, seats, chat panel, and gifting drawer
 */
import { ref } from 'vue';
import { useWindowFocus } from '@vueuse/core';
const roomStore = useRoomStore()
const { joinRoom, leaveRoom, connectionStatus, isLocalMuted, toggleLocalMute, isProducing } = useRoomAudio()
const toast = useToast()

// Track join in progress to prevent double-joins
const isJoining = ref(false)
watch(
    () => roomStore.currentRoom,
    async (newRoom, oldRoom) => {
      // ========================================
      // Case 1: Room Closed
      // ========================================
      if (oldRoom && !newRoom) {
        leaveRoom()
        return
      }
      // ========================================
      // Case 2: Room Changed (switched rooms)
      // ========================================
      if (oldRoom && newRoom && oldRoom.id !== newRoom.id) {
        leaveRoom()  // Leave old room first
        // Fall through to join new room
      }
      // ========================================
      // Case 3: New Room Opened
      // ========================================
      if (newRoom && (!oldRoom || oldRoom.id !== newRoom.id)) {
        if (isJoining.value) return  // Prevent double-join

        isJoining.value = true
        try {
          await joinRoom(String(newRoom.id))
        } catch (error) {
          console.error('[RoomShell] Failed to join audio:', error)
          toast.add({
            title: 'Audio connection failed',
            description: 'Chat and gifting will still work.',
            color: 'warning',
          })
          // Don't close room - let user stay with chat-only mode
        } finally {
          isJoining.value = false
        }
      }
    },
    { immediate: true }
)
// ========================================
// Handle Reconnection After Tab Focus
// ========================================
const isFocused = useWindowFocus()
watch(isFocused, async (focused) => {
  if (focused && roomStore.currentRoom && connectionStatus.value === 'disconnected') {
    // Tab regained focus and we're in a room but disconnected
    try {
      await joinRoom(String(roomStore.currentRoom.id))
    } catch {
      // Silent fail - user is back, will see error if needed
    }
  }
})
// ========================================
// Cleanup on Component Unmount
// ========================================
onUnmounted(() => {
  if (roomStore.currentRoom) {
    leaveRoom()
  }
})

</script>

<template>
  <div class="absolute inset-0 z-50 p-1 pb-5 bg-elevated">
    <!-- Background Image -->
    <div class="absolute inset-0 z-0">
      <NuxtImg
          provider="imagekit"
          src="/siteAssets/backgrounds/eagle3.jpg"
          class="size-full object-cover"
      />
    </div>

    <!-- Content -->
    <div class="relative z-10 h-full flex flex-col">

      <RoomHeader />

      <RoomInfo />

      <!-- Seats Grid -->
      <main class="grid grid-cols-5 gap-x-4">
        <RoomSeat v-for="i in 15" :key="i" :seat-id="i" />
      </main>

      <RoomSeatDrawer title="Room Seat Drawer" description="Room Seat Description" />

      <!-- Bottom Section: Chat + Controls -->
      <div class="flex grow gap-1 mt-1 min-h-0 pl-2">
        <!-- Chat Panel -->
        <div class="size-full flex flex-col inset-shadow-2xs">
          <aside class="bg-linear-to-br from-elevated/80 to-primary/20 rounded-lg grow overflow-hidden">
            <RoomChatPanel />
          </aside>
        </div>

        <!-- Side Controls & Gifting -->
        <div class="flex flex-col items-center gap-3 justify-end">
          <!-- Volume Control (placeholder for future) -->
          <UButton icon="i-lucide-volume-2" size="md" variant="subtle" />
          <!-- Mic Mute/Unmute - only show when producing audio -->
          <UButton
              v-if="isProducing"
              size="md"
              :icon="isLocalMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
              :variant="isLocalMuted ? 'solid' : 'subtle'"
              :color="isLocalMuted ? 'error' : 'neutral'"
              @click="() => { toggleLocalMute() }"
          />
          <UButton v-else icon="i-lucide-mic" size="md" variant="soft" disabled />

          <RoomGiftDrawer />
        </div>

      </div>

    </div>

    <!-- Gift Playback Modal (full-screen, outside content area) -->
    <RoomGiftPlaybackModal />

  </div>
</template>