<script setup lang="ts">
const roomStore = useRoomStore();

// --- Control Body Scroll ---
let scrollPosition = 0;

const toggleBodyScroll = () => {
    // If room is open (currentRoom exists and NOT minimized), lock body.
    const isShellVisible = roomStore.currentRoom && !roomStore.isMinimized;
    
    if (isShellVisible) {
        scrollPosition = window.scrollY;
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollPosition}px`;
        document.body.style.width = '100%';
    } else {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollPosition);
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