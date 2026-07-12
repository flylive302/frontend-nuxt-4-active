<script setup lang="ts">
/**
 * Music Drawer — add tracks + manage the playlist queue.
 *
 * Presents a compact drop zone for picking local audio files (no server
 * upload — files stay local, ADR 0006) above the reorderable queue list.
 * Queue state is the module-level singleton in useRoomAudioPlayer, so this
 * drawer and the floating deck always agree.
 */
import { VueDraggable, type DraggableEvent } from 'vue-draggable-plus';
import type { Track } from '~/types/room/audio-player';
import { ASSETS } from '~/constants/assets';
import { useRoomAudioPlayer } from '~/composables/room/audio/useRoomAudioPlayer';

// ========================================
// Props & Emits
// ========================================

const open = defineModel<boolean>('open', { default: false });

const props = defineProps<{
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  filesSelected: [files: File[]];
}>();

// ========================================
// Dependencies
// ========================================

const roomStore = useRoomStore();
const { socket } = useAudioSocket();
const {
  queueTracks,
  currentTrackId,
  isPlaying,
  removeTrack,
  reorderTracks,
  playTrack,
} = useRoomAudioPlayer(socket);

// ========================================
// State
// ========================================

const isDragging = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

// Writable mirror of the queue for VueDraggable (v-model). The orchestrator's
// queue is the source of truth; this stays in step via the watch below.
const reorderModel = ref<Track[]>([]);

watch(
  queueTracks,
  (tracks) => { reorderModel.value = tracks.slice() as Track[]; },
  { immediate: true, flush: 'sync' },
);

// ========================================
// Constants
// ========================================

const ALLOWED_TYPES = [
  'audio/mpeg',   // .mp3
  'audio/mp4',    // .m4a
  'audio/ogg',    // .ogg
  'audio/webm',   // .webm
  'audio/wav',    // .wav
  'audio/aac',    // .aac
  'audio/flac',   // .flac
];

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ========================================
// Computed
// ========================================

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '');

// ========================================
// Handlers — file picking
// ========================================

/** Returns a specific rejection reason for `file`, or `null` when it is valid. */
function rejectionReason(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(mp3|m4a|ogg|webm|wav|aac|flac)$/i)) {
    return `"${file.name}" is not a supported audio file.`;
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `"${file.name}" is too large (max ${MAX_SIZE_MB}MB).`;
  }
  return null;
}

/** Validate each picked file; emit the valid ones and surface the first reject. */
function handleFiles(fileList: FileList | null | undefined) {
  error.value = null;
  const files = Array.from(fileList ?? []);
  if (files.length === 0) return;

  const valid: File[] = [];
  for (const file of files) {
    const reason = rejectionReason(file);
    if (reason) {
      error.value ??= reason;
    } else {
      valid.push(file);
    }
  }

  if (valid.length > 0) emit('filesSelected', valid);
}

function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  handleFiles(input.files);
  input.value = ''; // allow re-picking the same file(s)
}

function handleDrop(event: DragEvent) {
  isDragging.value = false;
  event.preventDefault();
  handleFiles(event.dataTransfer?.files);
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  isDragging.value = true;
}

function handleDragLeave() {
  isDragging.value = false;
}

function openFilePicker() {
  fileInput.value?.click();
}

// ========================================
// Handlers — queue
// ========================================

async function handleRemove(id: string): Promise<void> {
  if (currentRoomId.value) await removeTrack(id, currentRoomId.value);
}

/** Tap a queue row: play (or switch to) that track and re-open the deck. */
async function handleRowTap(id: string): Promise<void> {
  if (currentRoomId.value) await playTrack(currentRoomId.value, id);
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
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Music"
    description="Add tracks and manage the room playlist."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-4 pb-6 flex flex-col gap-4 max-h-[75vh]">

        <!-- Add tracks: compact drop zone -->
        <button
          type="button"
          class="relative flex items-center gap-3 w-full rounded-2xl border border-dashed p-3 text-left transition-colors overflow-hidden"
          :class="[
            isDragging ? 'border-primary bg-primary/10' : 'border-white/20 bg-white/5',
            props.isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:bg-white/10'
          ]"
          @click="openFilePicker"
          @drop="handleDrop"
          @dragover="handleDragOver"
          @dragleave="handleDragLeave"
        >
          <!-- Room-theme wash -->
          <div
            class="absolute inset-0 pointer-events-none opacity-20"
            style="background: radial-gradient(120% 160% at 0% 50%, var(--room-theme, var(--ui-primary)) 0%, transparent 60%);"
          />
          <span class="relative shrink-0 flex items-center justify-center size-11 rounded-full bg-primary/15 ring-1 ring-primary/30">
            <UIcon
              :name="props.isLoading ? 'i-lucide-loader-2' : 'i-lucide-plus'"
              class="text-xl text-primary"
              :class="{ 'animate-spin': props.isLoading }"
            />
          </span>
          <span class="relative flex flex-col min-w-0">
            <span class="text-sm font-semibold text-white">
              {{ props.isLoading ? 'Loading audio…' : 'Add tracks' }}
            </span>
            <span class="text-[11px] text-neutral-400">
              MP3, M4A, OGG, WAV, FLAC · max {{ MAX_SIZE_MB }}MB · stays on this device
            </span>
          </span>
        </button>

        <!-- Error Message -->
        <p v-if="error" class="text-xs text-error text-center -mt-2">
          {{ error }}
        </p>

        <!-- Hidden File Input -->
        <input
          ref="fileInput"
          type="file"
          accept="audio/*"
          multiple
          class="hidden"
          @change="handleFileChange"
        >

        <!-- Queue -->
        <div class="flex flex-col gap-2 min-h-0">
          <div class="flex items-center justify-between px-1">
            <span class="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 select-none">Up next</span>
            <span class="text-[11px] tabular-nums text-neutral-500 select-none">
              {{ reorderModel.length }} {{ reorderModel.length === 1 ? 'track' : 'tracks' }}
            </span>
          </div>

          <!-- Empty state -->
          <div
            v-if="reorderModel.length === 0"
            class="flex flex-col items-center gap-2 py-8 text-center select-none"
          >
            <UIcon name="i-lucide-disc-3" class="text-3xl text-neutral-600" />
            <p class="text-xs text-neutral-500">The playlist is empty — add tracks above to start the music.</p>
          </div>

          <!-- Reorderable track list (drag-to-reorder; SortableJS is browser-only) -->
          <ClientOnly>
            <VueDraggable
              v-if="reorderModel.length > 0"
              v-model="reorderModel"
              handle=".queue-drag-handle"
              :animation="150"
              :delay="120"
              :delay-on-touch-only="true"
              class="flex flex-col gap-1 overflow-y-auto touch-pan-y"
              @update="handleReorder"
            >
              <div
                v-for="track in reorderModel"
                :key="track.id"
                class="flex items-center gap-2 pl-1.5 pr-1 py-1.5 rounded-xl transition-colors cursor-pointer"
                :class="track.id === currentTrackId ? 'bg-primary/15 ring-1 ring-primary/30' : 'bg-white/5 hover:bg-white/10'"
                role="button"
                :aria-label="`Play ${track.title}`"
                @click="handleRowTap(track.id)"
              >
                <UIcon
                  name="i-lucide-grip-vertical"
                  class="queue-drag-handle shrink-0 text-base cursor-grab touch-none text-neutral-500 py-1.5"
                  @click.stop
                />
                <!-- Now-playing rows get the spinning vinyl -->
                <img
                  v-if="track.id === currentTrackId"
                  :src="ASSETS.MUSIC_PLAYER"
                  alt=""
                  class="shrink-0 size-7 rounded-full object-cover ring-1 ring-primary/40"
                  :class="isPlaying ? '' : 'grayscale opacity-70'"
                >
                <span
                  v-else
                  class="shrink-0 flex items-center justify-center size-7 rounded-full bg-white/5"
                >
                  <UIcon name="i-lucide-music" class="text-xs text-neutral-500" />
                </span>
                <span
                  class="flex-1 min-w-0 truncate text-[13px] select-none"
                  :class="track.id === currentTrackId ? 'text-white font-semibold' : 'text-neutral-300'"
                >
                  {{ track.title }}
                </span>
                <UButton
                  icon="i-lucide-trash-2"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  class="rounded-full shrink-0"
                  :aria-label="`Remove ${track.title}`"
                  @click.stop="handleRemove(track.id)"
                />
              </div>
            </VueDraggable>
          </ClientOnly>
        </div>
      </div>
    </template>
  </UDrawer>
</template>
