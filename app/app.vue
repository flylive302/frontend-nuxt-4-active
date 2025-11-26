<script setup lang="ts">
import { ref, watch } from "vue";

const roomOpen = ref(false);

watch(() => roomOpen.value, (v) => {
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

    <RoomShell
        v-if="roomOpen"
        :room-open="roomOpen"
        @update:room-open="roomOpen = $event;"
    />

    <RoomMinimized v-if="!roomOpen" @click="roomOpen = !roomOpen" />
  </UApp>
</template>