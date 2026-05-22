<script setup lang="ts">
import { onMounted, nextTick, ref } from 'vue';
import { ASSETS } from '~/constants/assets';
import { createLogger } from '~/utils/logger';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';

const log = createLogger('[RoomMinimizedClient]');

const roomStore = useRoomStore();
const { leaveRoom, isLocalMuted, isProducing, toggleLocalMute, setVolume } = useRoomAudio();

const { dragEl, position, setPosition, winW, winH, elW, elH } = useBoundedDrag();

onMounted(async () => {
  await nextTick();
  setPosition(winW.value - elW.value - 95, winH.value - elH.value - 140);
});

// ========================================
// Speaker volume (synced with room page via localStorage)
// ========================================
const VOLUME_KEY = 'flylive:room:volume';
const LAST_VOLUME_KEY = 'flylive:room:lastNonZeroVolume';

const _savedVol = typeof localStorage !== 'undefined'
  ? parseFloat(localStorage.getItem(VOLUME_KEY) ?? '0.8')
  : 0.8;
const _savedLast = typeof localStorage !== 'undefined'
  ? parseFloat(localStorage.getItem(LAST_VOLUME_KEY) ?? '0.8')
  : 0.8;

const isSpeakerMuted = ref(_savedVol === 0);
const lastNonZeroVolume = ref(_savedLast > 0 ? _savedLast : 0.8);

function toggleSpeaker(): void {
  if (isSpeakerMuted.value) {
    const vol = lastNonZeroVolume.value;
    setVolume(vol);
    isSpeakerMuted.value = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOLUME_KEY, String(vol));
    }
  } else {
    // Capture current volume before muting so room page can restore it on un-minimize
    const current = typeof localStorage !== 'undefined'
      ? parseFloat(localStorage.getItem(VOLUME_KEY) ?? '0.8')
      : 0.8;
    if (current > 0) {
      lastNonZeroVolume.value = current;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LAST_VOLUME_KEY, String(current));
      }
    }
    setVolume(0);
    isSpeakerMuted.value = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VOLUME_KEY, '0');
    }
  }
}
</script>

<template>
  <div
    ref="dragEl"
    :style="`left: ${position.x}px; top: ${position.y}px;`"
    class="fixed z-50 touch-none flex flex-col items-end gap-1"
  >
    <!-- Close button -->
    <UButton
      size="xs"
      icon="i-lucide-x"
      variant="soft"
      color="neutral"
      @click="() => {
        try {
          leaveRoom();
          roomStore.leaveRoom();
        } catch (error) {
          log.error('Failed to leave room:', error);
        }
      }"
    />

    <!-- Controls row: mic | logo | speaker -->
    <div class="flex items-center gap-2 cursor-move">
      <!-- Mic button — only visible when user has a seat (producing) -->
      <UButton
        v-if="isProducing"
        :icon="isLocalMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
        size="sm"
        :color="isLocalMuted ? 'error' : 'neutral'"
        variant="soft"
        @click.stop="toggleLocalMute()"
      />
      <!-- Spacer keeps logo centered when mic button is absent -->
      <div v-else class="size-8" />

      <!-- Room logo — tap to maximize and return to room -->
      <div
        class="bg-primary size-16 aspect-square p-1 rounded-full cursor-pointer"
        @click.stop="() => { roomStore.maximizeRoom(); navigateTo(`/room/${roomStore.currentRoom?.id}`) }"
      >
        <NuxtImg
          :src="roomStore.currentRoom?.logo ?? ASSETS.ROOM_CARD_TOP"
          alt="Minimized Room Preview"
          :width="64"
          :height="64"
          :quality="10"
          format="webp"
          class="h-full w-full object-cover rounded-full border pointer-events-none"
        />
      </div>

      <!-- Speaker mute button -->
      <UButton
        :icon="isSpeakerMuted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'"
        size="sm"
        :color="isSpeakerMuted ? 'warning' : 'neutral'"
        variant="soft"
        @click.stop="toggleSpeaker()"
      />
    </div>
  </div>
</template>
