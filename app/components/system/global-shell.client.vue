<script lang="ts" setup>
import { defineAsyncComponent } from 'vue'

const roomStore = useRoomStore()
const authStore = useAuthStore()
const route = useRoute()
const assetStore = useAssetStore()
const { progress, phase, showDownloadGate } = storeToRefs(assetStore)

const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

useRoomLifecycle()

const { init: initWakeLock } = useWakeLock()
initWakeLock()

const { init: initMediaSession } = useMediaSession()
initMediaSession()
</script>

<template>
  <div>
    <RoomMinimized v-if="authStore.isAuthenticated && roomStore.currentRoom && roomStore.isMinimized && !route.path.startsWith('/room/')" />

    <SystemDownloadScreen v-if="showDownloadGate" />

    <SystemDownloadProgressBar
      :progress="progress"
      :visible="phase === 'downloading' && !showDownloadGate"
    />

    <SystemStoragePermissionBanner />

    <SystemPwaInstallPrompt />

    <SystemUpdateAvailableToast />

    <EventsBadgeEarnedModal />
    <EventsLevelUpModal />
    <EventsIncomeTargetModal />
  </div>
</template>
