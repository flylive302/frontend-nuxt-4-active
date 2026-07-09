<script setup lang="ts">
/**
 * RoomAudioPlayer — Draggable, compact floating music player panel.
 *
 * Only visible to the DJ who owns the current music session (`isPlayerVisible`).
 * All other users receive no UI — audio reaches them silently via mediasoup.
 * The panel persists across Stop / end-of-queue (so the kept queue can be
 * replayed) and is dismissed only by the explicit ✕, an owner force-take, or
 * leaving the room. Play Music trigger lives in RoomSettingsDrawer.
 *
 * Layout: a compact card with transport always visible and the track list
 * tucked behind a collapsible "Queue" toggle.
 */
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus';
import type { Track } from '~/types/room/audio-player';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';
import { useRoomAudioPlayer } from '~/composables/room/audio/useRoomAudioPlayer';

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
  removeTrack,
  reorderTracks,
  setVolume,
} = useRoomAudioPlayer(socket);

// ========================================
// Draggable
// ========================================

// The floating player only drags from its title row (`dragHandle`), leaving the
// queue rows free for their own sortable touch-drag without the two fighting.
const dragHandle = ref<HTMLElement | null>(null);
const { dragEl, position, setPosition, winW, winH, elW, elH, isDragging } = useBoundedDrag({
  handle: dragHandle,
});

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

/** Collapsible track list — UI-only, collapsed by default to stay compact. */
const isQueueOpen = ref(false);

// Writable mirror of the queue for VueDraggable (v-model). The orchestrator's
// queue is the source of truth; this stays in step via the watch below.
const reorderModel = ref<Track[]>([]);

watch(
  queueTracks,
  (tracks) => { reorderModel.value = tracks.slice() as Track[]; },
  { immediate: true, flush: 'sync' },
);

// ========================================
// Computed
// ========================================

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '');

/** Title for the header: live metadata, else the queue's current track. */
const displayTitle = computed(() => {
  if (playerState.title) return playerState.title;
  const current = queueTracks.value.find((t) => t.id === currentTrackId.value);
  return current?.title ?? 'No track';
});

/** Disable transport when the queue has no current track to act on. */
const hasTrack = computed(() => currentTrackId.value !== null);

/** Progress percentage for the progress bar (0–100). */
const progress = computed(() => {
  if (playerState.duration <= 0) return 0;
  return (playerState.position / playerState.duration) * 100;
});

/** Formatted time display (MM:SS / MM:SS). */
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

async function handleRemove(id: string): Promise<void> {
  if (currentRoomId.value) await removeTrack(id, currentRoomId.value);
}

/**
 * A queue row was dragged to a new position. Delegate the reorder to the model,
 * then re-sync the local mirror so SortableJS's DOM shift doesn't diverge from
 * the authoritative order.
 */
function handleReorder(event: DraggableEvent): void {
  const from = event.oldIndex ?? 0;
  const to = event.newIndex ?? 0;
  reorderModel.value = queueTracks.value.slice() as Track[]; // revert before re-render
  if (from !== to) reorderTracks(from, to);
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
    class="fixed z-50 w-68 max-w-[calc(100vw-1.5rem)]"
  >
    <div class="flex flex-col gap-2 px-3 py-2.5 rounded-2xl bg-neutral-900/90 backdrop-blur-xl shadow-xl ring-1 ring-white/10">

      <!-- Header: drag handle + marquee title + close -->
      <div class="flex items-center gap-1.5">
        <div
          ref="dragHandle"
          class="flex flex-1 min-w-0 items-center gap-1.5 touch-none"
          :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
        >
          <UIcon name="i-lucide-grip-vertical" class="shrink-0 text-sm text-neutral-500" />
          <UIcon name="i-lucide-music" class="shrink-0 text-sm text-primary" />
          <MarqueeName
            :name="displayTitle"
            text-class="text-xs font-semibold text-white"
            class="flex-1 min-w-0 select-none"
          />
        </div>
        <UButton
          icon="i-lucide-x"
          size="sm"
          variant="ghost"
          color="neutral"
          class="rounded-full"
          aria-label="Close music player"
          @click="handleClose"
        />
      </div>

      <!-- Progress bar (clickable to seek) + time -->
      <div class="flex items-center gap-2">
        <div
          class="h-1.5 flex-1 bg-neutral-700 rounded-full cursor-pointer overflow-hidden"
          @click="handleSeek"
        >
          <div
            class="h-full bg-primary rounded-full transition-all duration-200"
            :style="{ width: `${progress}%` }"
          />
        </div>
        <span class="shrink-0 text-[10px] tabular-nums text-neutral-400 select-none">{{ timeDisplay }}</span>
      </div>

      <!-- Transport + queue toggle -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-0.5">
          <UButton
            icon="i-lucide-skip-back"
            size="sm"
            variant="ghost"
            color="neutral"
            class="rounded-full"
            :disabled="!hasPrev"
            aria-label="Previous track"
            @click="handlePrev"
          />
          <UButton
            :icon="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
            size="md"
            variant="soft"
            color="primary"
            class="rounded-full"
            :disabled="!hasTrack"
            :aria-label="isPlaying ? 'Pause' : 'Play'"
            @click="handleMainAction"
          />
          <UButton
            icon="i-lucide-skip-forward"
            size="sm"
            variant="ghost"
            color="neutral"
            class="rounded-full"
            :disabled="!hasNext"
            aria-label="Next track"
            @click="handleNext"
          />
          <UButton
            icon="i-lucide-square"
            size="sm"
            variant="ghost"
            color="error"
            class="rounded-full"
            :disabled="!isPlaying && !isPaused"
            aria-label="Stop"
            @click="handleStop"
          />
        </div>

        <!-- Queue toggle (count + chevron) -->
        <UButton
          size="sm"
          variant="ghost"
          color="neutral"
          class="rounded-full gap-1"
          :aria-label="isQueueOpen ? 'Hide queue' : 'Show queue'"
          @click="isQueueOpen = !isQueueOpen"
        >
          <UIcon name="i-lucide-list-music" class="text-sm" />
          <span class="text-[11px] font-medium tabular-nums">{{ queueTracks.length }}</span>
          <UIcon
            name="i-lucide-chevron-down"
            class="text-xs transition-transform"
            :class="{ 'rotate-180': isQueueOpen }"
          />
        </UButton>
      </div>

      <!-- Volume -->
      <div class="flex items-center gap-2">
        <UIcon
          :name="localVolume > 0 ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
          class="shrink-0 text-sm text-neutral-400"
        />
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          :value="localVolume"
          class="flex-1 h-1.5 accent-primary cursor-pointer"
          aria-label="Volume"
          @input="handleVolumeChange(Number(($event.target as HTMLInputElement).value))"
        >
      </div>

      <!-- Collapsible playlist queue (drag-to-reorder; SortableJS is browser-only) -->
      <div v-if="isQueueOpen" class="border-t border-white/10 pt-2">
        <p
          v-if="reorderModel.length === 0"
          class="text-[11px] text-center text-neutral-500 py-2 select-none"
        >
          Queue is empty — add tracks from Room Settings.
        </p>
        <ClientOnly>
          <VueDraggable
            v-if="reorderModel.length > 0"
            v-model="reorderModel"
            handle=".queue-drag-handle"
            :animation="150"
            :delay="120"
            :delay-on-touch-only="true"
            class="max-h-44 overflow-y-auto flex flex-col gap-0.5 touch-pan-y"
            @update="handleReorder"
          >
            <div
              v-for="track in reorderModel"
              :key="track.id"
              class="flex items-center gap-1.5 pl-1 pr-0.5 py-1 rounded-lg"
              :class="track.id === currentTrackId ? 'bg-primary/20' : 'hover:bg-white/5'"
            >
              <UIcon
                name="i-lucide-grip-vertical"
                class="queue-drag-handle shrink-0 text-sm cursor-grab touch-none text-neutral-500 py-1"
              />
              <UIcon
                :name="track.id === currentTrackId ? 'i-lucide-volume-2' : 'i-lucide-music'"
                class="shrink-0 text-xs"
                :class="track.id === currentTrackId ? 'text-primary' : 'text-neutral-500'"
              />
              <span
                class="flex-1 min-w-0 truncate text-xs select-none"
                :class="track.id === currentTrackId ? 'text-white font-medium' : 'text-neutral-300'"
              >
                {{ track.title }}
              </span>
              <UButton
                icon="i-lucide-trash-2"
                size="sm"
                variant="ghost"
                color="neutral"
                class="rounded-full shrink-0"
                :aria-label="`Remove ${track.title}`"
                @click="handleRemove(track.id)"
              />
            </div>
          </VueDraggable>
        </ClientOnly>
      </div>
    </div>
  </div>
</template>
