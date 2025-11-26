<script setup lang="ts">
import { watch } from "vue";

const roomStore = useRoomStore();

watch(() => roomStore.roomMinimized, (v) => {
  document.body.style.overflow = v ? 'hidden' : 'auto'
  document.body.style.position = v ? 'fixed' : 'relative'
})

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