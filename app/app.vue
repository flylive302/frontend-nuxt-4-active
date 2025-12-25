<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { BODY_UNLOCK_DELAY_MS } from '~/constants/room'

// Lazy-load room components - only loaded when user joins a room
const RoomShell = defineAsyncComponent(() => import('~/components/room/shell.vue'))
const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

const roomStore = useRoomStore();

const toggleBodyScroll = () => {
  // If room is open (currentRoom exists and NOT minimized), lock body.
  const isShellVisible = roomStore.currentRoom && !roomStore.isMinimized;

  if (isShellVisible) {
    document.body.removeAttribute('style');
    document.body.classList.remove('unlock-body');
    document.body.classList.add('lock-body');
  } else {
    setTimeout(() => {
      document.body.removeAttribute('style');
      document.body.classList.remove('lock-body');
      document.body.classList.add('unlock-body');
    }, BODY_UNLOCK_DELAY_MS);
  }
}
// Run on component mount and whenever state changes
watch(
    [() => roomStore.isMinimized, () => roomStore.currentRoom], 
    toggleBodyScroll,
    { immediate: true }
)
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <RoomShell 
      v-if="roomStore.currentRoom"
      :class="!roomStore.isMinimized ? 'show-room-shell' : 'hide-room-shell'"
    />

    <RoomMinimized 
      v-if="roomStore.currentRoom"
      :class="roomStore.isMinimized ? 'show-room-shell' : 'hide-room-shell'"
    />
  </UApp>
</template>