<script setup lang="ts">
import { ref, watch } from "vue";

const roomOpen = ref(false);

watch(() => roomOpen.value, (v) => {
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <LazyRoomShell
        v-if="roomOpen"
        :room-open="roomOpen"
        @update:room-open="roomOpen = $event;"
    />

    <RoomMinimized v-if="!roomOpen" @click="roomOpen = !roomOpen" />
  </div>
</template>