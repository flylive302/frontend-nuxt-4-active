<script setup lang="ts">
/**
 * RoomShell - Main room container component
 * Integrates header, seats, chat panel, and gifting drawer
 */
import { ref } from 'vue';
import { useScreenSafeArea, useMutationObserver, useWindowFocus, useMediaQuery } from '@vueuse/core';
const roomStore = useRoomStore()
const { joinRoom, leaveRoom, connectionStatus } = useRoomAudio()
const toast = useToast()

const {top, right, bottom, left,} = useScreenSafeArea();

const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

const shellRef = ref<HTMLElement | null>(null);

// Handle inert attribute for accessibility
useMutationObserver(shellRef, () => {
  const el = shellRef.value;
  if (!el) {
    return;
  }

  const ariaHidden = el.getAttribute('aria-hidden');

  if (ariaHidden === 'true') {
    el.setAttribute('inert', '');
    const activeElement = document.activeElement;

    if (activeElement instanceof HTMLElement && el.contains(activeElement)) {
      activeElement.blur();
    }
  } else {
    el.removeAttribute('inert');
  }
}, {
  attributes: true,
  attributeFilter: ['aria-hidden'],
});

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
  <div
    ref="shellRef"
    class="fixed bg-black z-50 p-1 overscroll-none"
    :style="`top: -${top}; bottom: ${bottom};left: ${left};right: ${right}`"
  >
    <!-- Background -->
    <div class="fixed inset-0 z-0">
      <div class="fixed inset-0 z-0 bg-gray-950/20" />
      <NuxtImg 
        v-if="!prefersReducedMotion"
        provider="imagekit" 
        src="/siteAssets/backgrounds/5.gif" 
        class="size-full object-cover" 
      />
      <NuxtImg 
        v-else
        provider="imagekit" 
        src="/siteAssets/backgrounds/5.jpg" 
        class="size-full object-cover" 
      />
    </div>

    <!-- Content -->
    <div class="relative z-10 h-full flex flex-col">
      <RoomHeader />

      <RoomInfo />

      <!-- Seats Grid -->
      <main class="grid grid-cols-5 gap-x-1 gap-y-1 px-1">
        <RoomSeat v-for="i in 15" :key="i" :seat-id="i" />
        <RoomSeatDrawer />
      </main>

      <!-- Bottom Section: Chat + Controls -->
      <div class="flex flex-grow gap-1 mt-1 min-h-0">
        <!-- Chat Panel -->
        <div class="min-h-full w-full flex flex-col">
          <aside class="bg-gradient-to-br from-gray-900/80 to-primary-900/30 border border-primary/30 rounded-lg flex-grow overflow-hidden">
            <RoomChatPanel />
          </aside>

          <!-- Quick Actions -->
          <footer class="flex gap-2 p-1">
            <UButton icon="i-lucide-mic" size="md" variant="subtle" />
            <UButton icon="i-lucide-volume-2" size="md" variant="subtle" />
            <UButton icon="i-lucide-users" size="md" variant="subtle" />
            <UButton icon="i-lucide-settings" size="md" variant="subtle" />
          </footer>
        </div>

        <!-- Side Controls & Gifting -->
        <div class="flex flex-col items-center gap-1 justify-end">
          <NuxtImg src="/room/room-prop.png" alt="room prop" class="w-12" />
          <NuxtImg src="/room/room-prop-2.png" alt="room prop" class="w-12" />
          <NuxtImg src="/room/room-prop-2.png" alt="room prop" class="w-12" />
          <RoomGiftingDrawer />
        </div>
      </div>
    </div>
  </div>
</template>
