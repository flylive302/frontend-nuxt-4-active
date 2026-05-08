<script lang="ts" setup>
import { defineAsyncComponent } from 'vue'

const roomStore = useRoomStore()
const assetStore = useAssetStore()
const { progress, phase } = storeToRefs(assetStore)

const RoomMinimized = defineAsyncComponent(() => import('~/components/room/minimized.client.vue'))

useRoomLifecycle()

const { init: initWakeLock } = useWakeLock()
initWakeLock()

const { init: initMediaSession } = useMediaSession()
initMediaSession()
</script>

<template>
  <div>
    <RoomMinimized v-if="roomStore.currentRoom && roomStore.isMinimized" />

    <SystemDownloadProgressBar
      :progress="progress"
      :visible="phase === 'downloading'"
    />

    <SystemStoragePermissionBanner />

    <SystemPwaInstallPrompt />

    <SystemUpdateAvailableToast />

    <EventsBadgeEarnedModal />
    <EventsLevelUpModal />
    <EventsIncomeTargetModal />
  </div>
</template>
