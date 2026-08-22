<script setup lang="ts">
import { computed, onMounted, nextTick } from 'vue';
import { ASSETS } from '~/constants/assets';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';
import { roomLogoSquareSrc } from '~/utils/imagekit';

const roomStore = useRoomStore();

const roomSessionStore = useRoomSessionStore();

const roomSession = useRoomSession();
const { leaveRoom, isProducing, isLocalMuted, toggleLocalMute } = useRoomAudio();
const { returnToRoom: returnToMinimizedRoom } = useRoomEntry();

const { dragEl, position, setPosition, winW, winH, elW, elH } = useBoundedDrag();

// The room to display/return to: the live session if connected, otherwise the
// persisted snapshot restored after a cold start.
const displayRoom = computed(() => roomStore.currentRoom ?? roomSessionStore.minimizedRoom);

// Mic is audible to the room only while producing AND not locally muted.
const isMicLive = computed(() => isProducing.value && !isLocalMuted.value);

// Room preview thumbnail — dynamic logo URL needs the square-crop transform (circular
// `size-16` bubble → ~160px @2.5x DPR); the ROOM_CARD_TOP fallback already carries its
// own `tr` so this no-ops for that branch.
const roomPreviewSrc = computed(() =>
  roomLogoSquareSrc(displayRoom.value?.logo ?? ASSETS.ROOM_CARD_TOP, 160),
);

// Set initial position after mount when element dimensions are known
onMounted(async () => {
  await nextTick();
  setPosition(winW.value - elW.value - 95, winH.value - elH.value - 140);
});

// ========================================
// Handlers (INTENT — delegate to composables)
// ========================================

/** Return to the room — handles both the live session and the cold-start snapshot. */
function returnToRoom(): void {
  if (displayRoom.value) returnToMinimizedRoom(displayRoom.value);
}

/** Explicit disconnect — the only mini-player path that tears down the room. */
function disconnect(): void {
  try {
    leaveRoom();
    roomSession.leaveRoom();
  } catch {
    // teardown is best-effort
  }
}
</script>

<template>
  <div
      ref="dragEl"
      :style="`left: ${position.x}px; top: ${position.y}px;`"
      class="fixed flex items-center z-50 touch-none cursor-move gap-1"
  >
    <!-- Room bubble — tap to return to the room -->
    <div class="relative bg-primary size-16 aspect-square p-1 rounded-full" @click="returnToRoom">
      <NuxtImg
          :src="roomPreviewSrc"
          alt="Minimized Room Preview"
          :width="64"
          :height="64"
          :quality="10"
          format="webp"
          class="h-full w-full object-cover rounded-full border pointer-events-none"
      />

      <!-- Mic-live indicator: pulsing red dot whenever this user's mic is
           audible to the room (seated speaker, not muted). Privacy-critical:
           a live mic must never be invisible. -->
      <span
          v-if="isMicLive"
          class="absolute -top-0.5 -right-0.5 flex size-4"
          aria-label="Microphone is live"
      >
        <span class="absolute inline-flex h-full w-full rounded-full bg-error opacity-75 animate-ping" />
        <span class="relative inline-flex size-4 rounded-full bg-error ring-2 ring-white items-center justify-center">
          <UIcon name="i-lucide-mic" class="size-2.5 text-white" />
        </span>
      </span>
    </div>

    <!-- Mic mute/unmute — only while producing audio (seated speaker) -->
    <UButton
        v-if="isProducing"
        size="sm"
        :icon="isLocalMuted ? 'i-lucide-mic-off' : 'i-lucide-mic'"
        :color="isLocalMuted ? 'error' : 'primary'"
        :variant="isLocalMuted ? 'solid' : 'subtle'"
        :aria-label="isLocalMuted ? 'Unmute microphone' : 'Mute microphone'"
        @click="() => { toggleLocalMute() }"
    />

    <!-- Explicit leave -->
    <UButton
        size="sm" icon="i-lucide-x" color="neutral" variant="soft"
        aria-label="Leave room"
        @click="disconnect"
    />
  </div>
</template>
