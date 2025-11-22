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

    <LazyRoomShell
        v-if="roomOpen"
        :room-open="roomOpen"
        @update:room-open="roomOpen = $event;"
    />

    <RoomMinimized v-if="!roomOpen" @click="roomOpen = !roomOpen" />
    <div id="teleport-here" class="bg-info fixed z-[9999999] h-80 w-40"/>
  </UApp>
</template>