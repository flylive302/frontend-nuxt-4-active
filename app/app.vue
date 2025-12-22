<script setup lang="ts">
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
    },1000);
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