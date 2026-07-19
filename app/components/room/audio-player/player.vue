<script setup lang="ts">
/**
 * RoomAudioPlayer — Draggable floating vinyl deck for the active DJ.
 *
 * Only visible to the DJ who owns the current music session (`isPlayerVisible`).
 * All other users receive no UI — audio reaches them silently via mediasoup.
 * The panel persists across Stop / end-of-queue (so the kept queue can be
 * replayed) and is dismissed only by the explicit ✕, an owner force-take, or
 * leaving the room.
 *
 * Layout: a compact glass card — spinning vinyl wrapped in a seekable progress
 * ring on the left, marquee title + transport on the right. Dragging the card
 * to any screen edge docks it as a single vinyl disc; tapping the disc expands
 * it back. The queue lives in the Music drawer (RoomAudioPlayerUploader),
 * opened from the playlist button.
 *
 * Talk-over duck (ADR 0018): holding the vinyl (either state) ducks the music
 * for the Room and the DJ's own monitor together; releasing restores it. Tap
 * vs. hold is disambiguated by `useHoldGesture`, a pure pointer state machine —
 * on the minimized disc, tap expands; on the vinyl generally, tap is
 * otherwise a no-op.
 */
import type { Track } from '~/types/room/audio-player';
import { ASSETS } from '~/constants/assets';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';
import { useHoldGesture } from '~/composables/useHoldGesture';
import { useRoomAudioPlayer } from '~/composables/room/audio/useRoomAudioPlayer';
import { useRoomMusicLaunch } from '~/composables/room/audio/useRoomMusicLaunch';

// ========================================
// Constants
// ========================================

/** Distance (px) from a viewport edge at drag-end that docks the player. */
const DOCK_THRESHOLD = 28;
/** Pointer travel (px) below which a drag on the docked disc counts as a tap. */
const TAP_SLOP = 6;
/** Docked disc diameter (px) — thumb-sized but unobtrusive. */
const DISC_SIZE = 56;
/** Progress ring geometry (viewBox units). */
const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ========================================
// Dependencies
// ========================================

const roomStore = useRoomStore();
const { socket } = useAudioSocket();

const {
  playerState,
  queueTracks,
  currentTrackId,
  isPlaying,
  isPaused,
  isPlayerVisible,
  isWaiting,
  queuePosition,
  hasNext,
  hasPrev,
  play,
  pause,
  resume,
  seek,
  stop,
  closePlayer,
  next,
  prev,
  setVolume,
  duckStart,
  duckEnd,
} = useRoomAudioPlayer(socket);

// Widget-owned instance of the Music drawer (queue + add tracks). The queue
// state itself is a module-level singleton, so this stays in sync with the
// Room Settings entry point.
const {
  showUploader,
  isLoading: isUploaderLoading,
  handleFilesSelected,
} = useRoomMusicLaunch(socket);

// ========================================
// Draggable + edge docking
// ========================================

const dragHandle = ref<HTMLElement | null>(null);
const { dragEl, position, setPosition, winW, winH, elW, elH, isDragging } = useBoundedDrag({
  handle: dragHandle,
  edgePadding: 8,
});

/** Docked-to-edge state: card collapses to a single vinyl disc. */
const isMinimized = ref(false);

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

// Track pointer travel per drag so a tap on the docked disc expands instead of
// re-docking, and so an expanded card only docks after a real drag.
let dragStart = { x: 0, y: 0 };

watch(isDragging, (dragging) => {
  if (dragging) {
    dragStart = { x: position.value.x, y: position.value.y };
    return;
  }

  const moved = Math.hypot(position.value.x - dragStart.x, position.value.y - dragStart.y);

  // A real drag (past TAP_SLOP) re-docks; a stationary release is left to the
  // hold gesture below to classify as a tap (expand) vs. a hold (duck).
  if (isMinimized.value) {
    if (moved >= TAP_SLOP) snapToNearestEdge();
    return;
  }

  if (moved >= TAP_SLOP && isNearEdge()) minimize();
});

// ========================================
// Talk-over duck (ADR 0018): hold the vinyl to duck, tap (minimized) to expand
// ========================================

/** Minimized: tap expands. Expanded: tap on the vinyl is a no-op. */
function handleVinylTap(): void {
  if (isMinimized.value) expand();
}

const vinylGesture = useHoldGesture({
  onTap: handleVinylTap,
  onHoldStart: duckStart,
  onHoldEnd: duckEnd,
});

/** Whether any side of the card sits within the dock threshold of the viewport. */
function isNearEdge(): boolean {
  const { x, y } = position.value;
  return (
    x <= DOCK_THRESHOLD ||
    y <= DOCK_THRESHOLD ||
    winW.value - (x + elW.value) <= DOCK_THRESHOLD ||
    winH.value - (y + elH.value) <= DOCK_THRESHOLD
  );
}

/** Collapse to the disc, then snap flush once the smaller size has rendered. */
function minimize(): void {
  isMinimized.value = true;
  nextTick(() => snapToNearestEdge());
}

/** Flush-dock the disc against whichever edge is closest. */
function snapToNearestEdge(): void {
  const { x, y } = position.value;
  const distances = {
    left: x,
    right: winW.value - (x + DISC_SIZE),
    top: y,
    bottom: winH.value - (y + DISC_SIZE),
  };
  const edge = (Object.keys(distances) as Array<keyof typeof distances>)
    .reduce((a, b) => (distances[a] <= distances[b] ? a : b));

  if (edge === 'left') setPosition(8, y);
  else if (edge === 'right') setPosition(winW.value - DISC_SIZE - 8, y);
  else if (edge === 'top') setPosition(x, 8);
  else setPosition(x, winH.value - DISC_SIZE - 8);
}

/** Restore the full card, nudged inward so it doesn't immediately re-dock. */
function expand(): void {
  isMinimized.value = false;
  const { x, y } = position.value;
  nextTick(() => {
    setPosition(
      x < winW.value / 2 ? x + DOCK_THRESHOLD + 8 : x - DOCK_THRESHOLD - 8,
      Math.min(y, winH.value - elH.value - DOCK_THRESHOLD - 8),
    );
  });
}

// ========================================
// State
// ========================================

const localVolume = ref(1);

// ========================================
// Computed
// ========================================

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '');

/** Title for the header: live metadata, else the queue's current track. */
const displayTitle = computed(() => {
  if (playerState.title) return playerState.title;
  const current = queueTracks.value.find((t: Track) => t.id === currentTrackId.value);
  return current?.title ?? 'No track';
});

/** Disable transport when the queue has no current track to act on. */
const hasTrack = computed(() => currentTrackId.value !== null);

/** Progress fraction (0–1) for the vinyl ring. */
const progress = computed(() => {
  if (playerState.duration <= 0) return 0;
  return Math.min(1, playerState.position / playerState.duration);
});

/** Ring stroke offset — full circumference = empty, 0 = complete. */
const ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - progress.value));

const timeDisplay = computed(() => `${formatTime(playerState.position)} / ${formatTime(playerState.duration)}`);

// ========================================
// Helpers
// ========================================

/** Format seconds to MM:SS string. */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ========================================
// Handlers
// ========================================

/** One button drives the whole play lifecycle: pause ⇄ resume, or replay after Stop. */
async function handleMainAction(): Promise<void> {
  if (isPlaying.value) { await pause(); return; }
  if (isPaused.value) { await resume(); return; }
  if (currentRoomId.value) await play(currentRoomId.value); // replay the kept queue
}

function handleStop(): void {
  if (!currentRoomId.value) return;
  // Stops playback + releases the MSAB mutex, but keeps the panel + queue so the
  // DJ can replay. The panel hides only via the explicit ✕ (handleClose).
  stop(currentRoomId.value);
}

function handleClose(): void {
  closePlayer(currentRoomId.value);
}

async function handleNext(): Promise<void> {
  if (currentRoomId.value) await next(currentRoomId.value);
}

async function handlePrev(): Promise<void> {
  if (currentRoomId.value) await prev(currentRoomId.value);
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
    Rendered for every room participant, but only visible to the DJ who owns the
    current music session (isPlayerVisible). The panel persists across Stop /
    end-of-queue and closes only via ✕ / force-take / leave.
  -->
  <div
    v-if="isPlayerVisible"
    ref="dragEl"
    :style="`left: ${position.x}px; top: ${position.y}px;`"
    class="fixed z-50"
    :class="isMinimized ? '' : 'w-72 max-w-[calc(100vw-1rem)]'"
  >
    <!-- ═══ Docked disc: single vinyl with progress ring ═══ -->
    <div
      v-if="isMinimized"
      ref="dragHandle"
      class="relative touch-none select-none cursor-pointer"
      :style="`width: ${DISC_SIZE}px; height: ${DISC_SIZE}px;`"
      role="button"
      aria-label="Expand music player"
      @pointerdown="vinylGesture.onPointerDown"
      @pointerup="vinylGesture.onPointerUp"
      @pointercancel="vinylGesture.onPointerCancel"
      @pointerleave="vinylGesture.onPointerLeave"
    >
      <img
        :src="ASSETS.MUSIC_PLAYER"
        alt=""
        draggable="false"
        class="size-full rounded-full object-cover shadow-lg shadow-black/50 ring-2 ring-black/60"
        :class="isPlaying ? '' : 'grayscale'"
      >
      <!-- Progress ring hugging the disc edge -->
      <svg viewBox="0 0 100 100" class="absolute inset-0 size-full -rotate-90 pointer-events-none">
        <circle cx="50" cy="50" :r="RING_RADIUS" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="5" />
        <circle
          cx="50" cy="50" :r="RING_RADIUS" fill="none"
          class="stroke-primary transition-[stroke-dashoffset] duration-500"
          stroke-width="5" stroke-linecap="round"
          :stroke-dasharray="RING_CIRCUMFERENCE"
          :stroke-dashoffset="ringOffset"
        />
      </svg>
      <!-- Playing pulse dot -->
      <span
        v-if="isPlaying"
        class="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-primary animate-pulse ring-2 ring-black/60"
      />
    </div>

    <!-- ═══ Expanded deck card ═══ -->
    <div
      v-else
      class="relative flex items-center gap-3 p-3 pr-2.5 rounded-[1.75rem] overflow-hidden backdrop-blur-3xl bg-black/60 shadow-2xl shadow-black/40 ring-1 ring-white/10"
    >
      <!-- Room-theme glow wash behind the vinyl -->
      <div
        class="absolute inset-0 pointer-events-none"
        style="background: radial-gradient(120% 140% at 0% 50%, var(--room-theme, var(--ui-primary)) 0%, transparent 55%);"
      />

      <!-- Vinyl + progress ring (also the drag handle; hold to duck, tap is a no-op) -->
      <div
        ref="dragHandle"
        class="relative shrink-0 size-16 touch-none select-none"
        :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
        @pointerdown="vinylGesture.onPointerDown"
        @pointerup="vinylGesture.onPointerUp"
        @pointercancel="vinylGesture.onPointerCancel"
        @pointerleave="vinylGesture.onPointerLeave"
      >
        <img
          :src="ASSETS.MUSIC_PLAYER"
          alt=""
          draggable="false"
          class="size-full rounded-full object-cover ring-2 ring-black/70 shadow-lg shadow-black/50"
          :class="isPlaying ? '' : 'grayscale opacity-80'"
        >
        <svg viewBox="0 0 100 100" class="absolute -inset-1 size-[calc(100%+0.5rem)] -rotate-90 pointer-events-none">
          <circle cx="50" cy="50" :r="RING_RADIUS" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="4" />
          <circle
            cx="50" cy="50" :r="RING_RADIUS" fill="none"
            class="stroke-primary transition-[stroke-dashoffset] duration-500"
            stroke-width="4" stroke-linecap="round"
            :stroke-dasharray="RING_CIRCUMFERENCE"
            :stroke-dashoffset="ringOffset"
          />
        </svg>
      </div>

      <!-- Title + seek + transport -->
      <div class="relative flex-1 min-w-0 flex flex-col gap-1.5">
        <div class="flex items-center gap-1">
          <MarqueeName
            :name="displayTitle"
            text-class="text-[13px] font-semibold text-white"
            class="flex-1 min-w-0 select-none"
          />
          <UButton
            icon="i-lucide-x"
            size="xs"
            variant="ghost"
            color="neutral"
            class="rounded-full -my-1"
            aria-label="Close music player"
            @click="handleClose"
          />
        </div>

        <!-- Seek bar + time -->
        <div class="flex items-center gap-2">
          <div
            class="h-1 flex-1 bg-white/15 rounded-full cursor-pointer"
            role="slider"
            aria-label="Seek"
            @click="handleSeek"
          >
            <div
              class="h-full bg-primary rounded-full transition-all duration-200"
              :style="{ width: `${progress * 100}%` }"
            />
          </div>
          <span class="shrink-0 text-[9px] tabular-nums text-neutral-400 select-none">{{ timeDisplay }}</span>
        </div>

        <!-- Transport row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-0.5">
            <UButton
              icon="i-lucide-skip-back"
              size="xs"
              variant="ghost"
              color="neutral"
              class="rounded-full"
              :disabled="!hasPrev"
              aria-label="Previous track"
              @click="handlePrev"
            />
            <UButton
              :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
              size="sm"
              variant="solid"
              color="primary"
              class="rounded-full shadow-md"
              :disabled="!hasTrack"
              :aria-label="isPlaying ? 'Pause' : 'Play'"
              @click="handleMainAction"
            />
            <UButton
              icon="i-lucide-skip-forward"
              size="xs"
              variant="ghost"
              color="neutral"
              class="rounded-full"
              :disabled="!hasNext"
              aria-label="Next track"
              @click="handleNext"
            />
            <UButton
              icon="i-lucide-square"
              size="xs"
              variant="ghost"
              color="error"
              class="rounded-full"
              :disabled="!isPlaying && !isPaused"
              aria-label="Stop"
              @click="handleStop"
            />
          </div>

          <!-- Playlist drawer trigger + volume popover -->
          <div class="flex items-center gap-0.5">
            <UPopover :ui="{ content: 'bg-neutral-900/90 backdrop-blur-xl ring-1 ring-white/10' }">
              <UButton
                :icon="localVolume > 0 ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
                size="xs"
                variant="ghost"
                color="neutral"
                class="rounded-full"
                aria-label="Volume"
              />
              <template #content>
                <div class="flex flex-col items-center gap-1 py-2 px-1.5">
                  <USlider
                    :model-value="localVolume"
                    :min="0"
                    :max="1"
                    :step="0.05"
                    orientation="vertical"
                    class="h-20"
                    aria-label="Music volume"
                    @update:model-value="(v: number | undefined) => handleVolumeChange(v ?? 1)"
                  />
                </div>
              </template>
            </UPopover>
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              class="rounded-full gap-1"
              aria-label="Open playlist"
              @click="() => { showUploader = true }"
            >
              <UIcon name="i-lucide-list-music" class="text-sm" />
              <span class="text-[10px] font-medium tabular-nums">{{ queueTracks.length }}</span>
            </UButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Music drawer (queue + add tracks) owned by the widget -->
    <RoomAudioPlayerUploader
      v-model:open="showUploader"
      :is-loading="isUploaderLoading"
      @files-selected="handleFilesSelected"
    />
  </div>

  <!--
    music-dj-queue/04: waiting-queue indicator. Rendered INDEPENDENTLY of
    isPlayerVisible — the live DJ's ~2s stateUpdate broadcast flips playerState to
    their id, which would hide anything nested in the player card. Shown while this
    admin is enqueued behind the current DJ; auto-clears on grant / leave / close.
  -->
  <div
    v-if="isWaiting"
    class="fixed left-1/2 -translate-x-1/2 bottom-24 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full backdrop-blur-xl bg-black/70 ring-1 ring-white/10 shadow-lg shadow-black/40"
  >
    <UIcon name="i-lucide-hourglass" class="text-sm text-primary animate-pulse" />
    <span class="text-[12px] font-medium text-white select-none">
      Waiting for the DJ slot<template v-if="queuePosition"> — #{{ queuePosition }} in line</template>
    </span>
  </div>
</template>
