<script setup lang="ts">
/**
 * RoomAudioPlayer — Draggable floating music player panel.
 *
 * Only visible to the room participant who is actively playing music.
 * All other users receive no UI — audio reaches them silently via mediasoup.
 * Play Music trigger lives in RoomSettingsDrawer (owner / admin only).
 */
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';
import { useRoomAudioPlayer } from '~/composables/room/audio/useRoomAudioPlayer';

// ========================================
// Dependencies
// ========================================

const authStore = useAuthStore();
const roomStore = useRoomStore();
const { socket } = useAudioSocket();

const {
  playerState,
  isPlaying,
  isPaused,
  isActive,
  pause,
  resume,
  seek,
  stop,
  setVolume,
} = useRoomAudioPlayer(socket);

// Access streaming to stop the music producer on stop
const { stopMusicProducer } = useMediasoupStreaming(socket);

// ========================================
// Draggable
// ========================================

const { dragEl, position, setPosition, winW, winH, elW, elH, isDragging } = useBoundedDrag();

// Position bottom-right once the element has been measured.
// useElementSize relies on ResizeObserver which fires asynchronously,
// so elW / elH are 0 at mount time → watch until they are non-zero.
const _stopInitPos = watch(
  [elW, elH],
  ([w, h]) => {
    if (w > 0 && h > 0) {
      setPosition(winW.value - w - 12, winH.value - h - 100);
      _stopInitPos();          // only need to run once
    }
  },
  { immediate: true },
);

// ========================================
// State
// ========================================

const localVolume = ref(1);

// ========================================
// Computed
// ========================================

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '');

/** Only truthy for the participant who is actively controlling music. */
const isMyMusic = computed(() => playerState.userId === authStore.user?.id);

/** Progress percentage for the progress bar (0–100). */
const progress = computed(() => {
  if (playerState.duration <= 0) return 0;
  return (playerState.position / playerState.duration) * 100;
});

/** Formatted time display (MM:SS / MM:SS). */
const timeDisplay = computed(() => {
  return `${formatTime(playerState.position)} / ${formatTime(playerState.duration)}`;
});

// ========================================
// Helpers
// ========================================

/**
 * Format seconds to MM:SS string.
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ========================================
// Handlers
// ========================================

async function handlePause(): Promise<void> {
  await pause();
}

async function handleResume(): Promise<void> {
  await resume();
}

async function handleStop(): Promise<void> {
  if (!currentRoomId.value) return;
  // Stop the mediasoup music producer first, then release the MSAB mutex
  stopMusicProducer();
  await stop(currentRoomId.value);
}

function handleSeek(event: MouseEvent): void {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  seek(percent * playerState.duration);
}

function handleVolumeChange(vol: number): void {
  localVolume.value = vol;
  setVolume(vol);
}
</script>

<template>
  <!--
    Rendered for every room participant, but only visible to the
    person actively playing music (isActive && isMyMusic).
  -->
  <div
    v-if="isActive && isMyMusic"
    ref="dragEl"
    :style="`left: ${position.x}px; top: ${position.y}px;`"
    class="fixed z-50 touch-none"
    :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
  >
    <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-neutral-900/90 backdrop-blur-xl shadow-xl ring-1 ring-white/10 min-w-52 max-w-72">

      <!-- Drag Handle + Track Info -->
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold truncate select-none">
          <UIcon name="i-lucide-music" class="inline-block mr-1 text-primary" />
          {{ playerState.title || 'Unknown Track' }}
        </p>

        <!-- Progress Bar (clickable for seek) -->
        <div
          class="mt-1.5 h-1 bg-neutral-700 rounded-full cursor-pointer overflow-hidden"
          @click="handleSeek"
        >
          <div
            class="h-full bg-primary rounded-full transition-all duration-200"
            :style="{ width: `${progress}%` }"
          />
        </div>

        <p class="text-[10px] text-neutral-400 mt-0.5 select-none">{{ timeDisplay }}</p>
      </div>

      <!-- Playback Controls -->
      <div class="flex items-center gap-1 shrink-0">
        <!-- Pause / Resume -->
        <UButton
          v-if="isPlaying"
          icon="i-lucide-pause"
          size="xs"
          variant="ghost"
          class="rounded-full"
          @click="handlePause"
        />
        <UButton
          v-else-if="isPaused"
          icon="i-lucide-play"
          size="xs"
          variant="ghost"
          class="rounded-full"
          @click="handleResume"
        />

        <!-- Stop -->
        <UButton
          icon="i-lucide-square"
          size="xs"
          variant="ghost"
          color="error"
          class="rounded-full"
          @click="handleStop"
        />
      </div>

      <!-- Volume Control -->
      <div class="flex items-center gap-1 shrink-0">
        <UIcon
          :name="localVolume > 0 ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
          class="text-neutral-400 text-xs"
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="localVolume"
          class="w-12 h-1 accent-primary"
          @input="handleVolumeChange(Number(($event.target as HTMLInputElement).value))"
        >
      </div>
    </div>
  </div>
</template>
