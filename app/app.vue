<script setup lang="ts">
const roomStore = useRoomStore();

const toggleBodyScroll = () => {
  // If room is open (currentRoom exists and NOT minimized), lock body.
  const isShellVisible = roomStore.currentRoom && !roomStore.isMinimized;

  if (isShellVisible) {
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100vw';
  } else {
    setTimeout(() => {
      document.body.removeAttribute('style');
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
      :class="!roomStore.isMinimized ? 'show-content' : 'hide-content'"
    />

    <RoomMinimized 
      v-if="roomStore.currentRoom"
      :class="roomStore.isMinimized ? 'show-content' : 'hide-content'" 
    />
  </UApp>
</template>