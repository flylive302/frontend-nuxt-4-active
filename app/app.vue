<script setup lang="ts">
const roomStore = useRoomStore();

// --- Control Body Scroll ---
const toggleBodyScroll = (isMinimized: boolean) => {
  document.body.style.overflow = isMinimized ? 'scroll' : 'scroll'
  document.body.style.position = isMinimized ? 'fixed' : 'relative'
}

// Run on component mount and whenever state changes
watch(() => roomStore.roomMinimized, toggleBodyScroll, { immediate: true })
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <RoomShell :class="roomStore.roomMinimized ? 'show-content' : 'hide-content'"/>

    <RoomMinimized :class="!roomStore.roomMinimized ? 'show-content' : 'hide-content'" />
  </UApp>
</template>