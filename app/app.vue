<script lang="ts" setup>
import {defineAsyncComponent} from 'vue'

const roomStore = useRoomStore()
// ========================================
// Asset Download Progress (bound to download bar in template)
// ========================================
const assetStore = useAssetStore()
const { progress, phase } = storeToRefs(assetStore);

// Lazy-load minimized room button — only loaded when user joins a room
const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

// ========================================
// Persistent Room Lifecycle (join/leave/reconnect)
// ========================================
// Watchers survive across all route changes — audio stays connected
useRoomLifecycle();

// ========================================
// Screen Wake Lock (prevents screen timeout while app is active)
// ========================================
const {init: initWakeLock} = useWakeLock()
initWakeLock()

// ========================================
// Media Session (keeps audio alive in background on iOS PWA / Android TWA)
// ========================================
const {init: initMediaSession} = useMediaSession()
initMediaSession()
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer/>
    <NuxtLoadingIndicator/>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>

    <!-- Minimized Room Button (floating, only when room is active & minimized) -->
    <RoomMinimized v-if="roomStore.currentRoom && roomStore.isMinimized"/>

    <!-- Download Progress Bar (top of screen during asset download) -->
    <SystemDownloadProgressBar
        :progress="progress"
        :visible="phase === 'downloading'"
    />

    <!-- Storage Permission Banner (auto-shows on first visit) -->
    <SystemStoragePermissionBanner/>

    <!-- PWA Install Prompt (auto-shows when browser fires before install prompt) -->
    <SystemPwaInstallPrompt/>

    <!-- Update Available Toast (auto-shows when new SW version is ready) -->
    <SystemUpdateAvailableToast/>

    <!-- Achievement Modals (triggered by socket events) -->
    <EventsBadgeEarnedModal/>
    <EventsLevelUpModal/>
    <EventsIncomeTargetModal/>
  </UApp>
</template>