<script setup lang="ts">
/**
 * RoomAudioPlayer — Main audio player container
 *
 * Displays the currently playing track info, progress bar,
 * and playback controls. Visible to all room participants.
 * Only the active music player (or room owner) can interact with controls.
 */
import { useRoomAudioPlayer } from '~/composables/room/audio/useRoomAudioPlayer';

// ========================================
// Dependencies
// ========================================

const roomStore = useRoomStore();
const authStore = useAuthStore();
const { socket } = useAudioSocket();

const {
  playerState,
  isPlaying,
  isPaused,
  isActive,
  isMusicPlayingInRoom,
  loadFile,
  play,
  pause,
  resume,
  seek,
  stop,
  setVolume,
} = useRoomAudioPlayer(socket);

// Access streaming to produce the music track through mediasoup
const { produceTrack, stopMusicProducer } = useMediasoupStreaming(socket);

// ========================================
// State
// ========================================

const showUploader = ref(false);
const localVolume = ref(1);
const isLoading = ref(false);

// ========================================
// Computed
// ========================================

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '');
const isMyMusic = computed(() => playerState.userId === authStore.user?.id);
const canControl = computed(() => isMyMusic.value);
const canPlayMusic = computed(() => !isMusicPlayingInRoom.value || isMyMusic.value);

/** Progress percentage for the progress bar */
const progress = computed(() => {
  if (playerState.duration <= 0) return 0;
  return (playerState.position / playerState.duration) * 100;
});

/** Formatted time display (MM:SS / MM:SS) */
const timeDisplay = computed(() => {
  const pos = formatTime(playerState.position);
  const dur = formatTime(playerState.duration);
  return `${pos} / ${dur}`;
});

// ========================================
// Helpers
// ========================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ========================================
// Handlers
// ========================================

async function handleFileSelected(file: File) {
  isLoading.value = true;
  try {
    await loadFile(file);
    showUploader.value = false;

    // Auto-play after loading
    await handlePlay();
  } catch (err) {
    console.error('Failed to load audio file:', err);
  } finally {
    isLoading.value = false;
  }
}

async function handlePlay() {
  if (!currentRoomId.value) return;

  // Get the media track from the audio player (Web Audio API → MediaStreamTrack)
  const track = await play(currentRoomId.value);
  if (!track) return;

  // Produce the music track through mediasoup so all room listeners hear it
  await produceTrack(track);
}

async function handlePause() {
  await pause();
}

async function handleResume() {
  await resume();
}

async function handleStop() {
  if (!currentRoomId.value) return;
  // Stop the mediasoup music producer first
  stopMusicProducer();
  // Then stop the audio player (releases mutex, cleans up Web Audio)
  await stop(currentRoomId.value);
}

function handleSeek(event: MouseEvent) {
  if (!canControl.value) return;
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  seek(percent * playerState.duration);
}

function handleVolumeChange(vol: number) {
  localVolume.value = vol;
  setVolume(vol);
}
</script>

<template>
  <div class="room-audio-player">
    <!-- Idle State: Show play music button -->
    <div v-if="!isActive && !isMusicPlayingInRoom" class="flex items-center gap-2">
      <UButton
        v-if="canPlayMusic"
        icon="i-lucide-music"
        size="sm"
        variant="subtle"
        class="shadow-md shadow-primary-950/50"
        @click="showUploader = true"
      >
        Play Music
      </UButton>
    </div>

    <!-- Active State: Show player UI -->
    <div
      v-if="isActive || isMusicPlayingInRoom"
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 backdrop-blur-xl"
    >
      <!-- Track Info -->
      <div class="flex-1 min-w-0">
        <p class="text-xs font-semibold truncate">
          <UIcon name="i-lucide-music" class="inline-block mr-1 text-primary" />
          {{ playerState.title || 'Unknown Track' }}
        </p>

        <!-- Progress Bar (clickable for seek) -->
        <div
          class="mt-1 h-1 bg-neutral-700 rounded-full cursor-pointer overflow-hidden"
          :class="{ 'cursor-default': !canControl }"
          @click="handleSeek"
        >
          <div
            class="h-full bg-primary rounded-full transition-all duration-200"
            :style="{ width: `${progress}%` }"
          />
        </div>

        <p class="text-[10px] text-neutral-400 mt-0.5">{{ timeDisplay }}</p>
      </div>

      <!-- Controls (only for the music player) -->
      <div v-if="canControl" class="flex items-center gap-1">
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

      <!-- Volume (only for the music player) -->
      <div v-if="canControl" class="flex items-center gap-1 ml-1">
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
        />
      </div>
    </div>

    <!-- File Picker Drawer -->
    <RoomAudioPlayerUploader
      v-model:open="showUploader"
      :is-loading="isLoading"
      @file-selected="handleFileSelected"
    />
  </div>
</template>
