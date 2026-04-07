<script setup lang="ts">
import { onMounted, nextTick } from 'vue';
import { createLogger } from '~/utils/logger';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';

const log = createLogger('[RoomMinimizedClient]');

const roomStore = useRoomStore();
const { leaveRoom } = useRoomAudio();

const { dragEl, position, setPosition, winW, winH, elW, elH } = useBoundedDrag();

// Set initial position after mount when element dimensions are known
onMounted(async () => {
  await nextTick();
  setPosition(winW.value - elW.value - 95, winH.value - elH.value - 140);
});
</script>

<template>
  <div
      ref="dragEl"
      :style="`left: ${position.x}px; top: ${position.y}px;`"
      class="fixed flex justify-center items-center z-50 touch-none cursor-move"
  >
    <div class="bg-primary size-16 aspect-square p-1 rounded-full z-50" @click="() => { roomStore.maximizeRoom(); navigateTo(`/room/${roomStore.currentRoom?.id}`) }">
      <NuxtImg
          :src="roomStore.currentRoom?.logo ?? 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp'"
          alt="Minimized Room Preview"
          :width="64"
          :height="64"
          :quality="10"
          format="webp"
          class="h-full w-full object-cover rounded-full border pointer-events-none"
      />
    </div>

    <UButton
        class="-ml-2" size="sm" icon="i-lucide-x"
        @click="() => {
          try {
            leaveRoom();
            roomStore.leaveRoom();
          } catch (error) {
            log.error('Failed to leave room:', error);
          }
        }"
    />
  </div>
</template>