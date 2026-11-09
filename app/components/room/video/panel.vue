<script setup lang="ts">
import { ROOM_VIDEO_SEEK_STEP_SEC } from '~/constants/room'

// ========================================
// Room Video panel (room-video-player 06)
// ========================================
//
// Mounted by the room page only while a Room Video is live. Expanded = 16:9
// player; collapsed = 40 px bar. Collapse and mute are this Watcher's own
// choices; Stop and the transport row (play / pause, seek, change link) are the
// Controller's — the server accepts transport from the holder only, so nobody else
// is shown controls they cannot use. An owner who is not the Controller gets one
// "Take over" chip instead. The player element itself is owned by
// `useRoomVideoSync` (attached to `playerSlot`), so collapsing only hides it —
// the audio keeps playing, which is what the bar's mute button is for.
//
// Chrome rules (ADR 0040): translucent fills, no backdrop-blur, transitions on
// transform / opacity only.
// ========================================

// ========================================
// Constants
// ========================================

const TAP_TO_WATCH_LABEL = 'Tap to watch'

// ========================================
// State
// ========================================

const playerSlot = ref<HTMLElement | null>(null)
const stopping = ref(false)
/** One in-flight pause / resume / seek at a time. */
const transportBusy = ref(false)
const showSourceDrawer = ref(false)
/** While the finger is on the seek bar: show this, do not follow the store. */
const dragging = ref(false)
const dragValue = ref(0)

// ========================================
// Composables
// ========================================

const store = useRoomVideoStore()
const sync = useRoomVideoSync()
const { stop, pause, resume, seek } = useRoomVideoActions()
const { myRank } = useRoomHierarchy()
const { invalidateSeatPositions } = useLuckyFly()

const title = computed(() => store.snapshot?.title ?? 'Room video')
const collapsedLabel = computed(() => (store.needsTap ? TAP_TO_WATCH_LABEL : title.value))
const isOwner = computed(() => myRank.value === 'owner')
const showTakeover = computed(() => isOwner.value && !store.isController)
const canOpenDrawer = computed(() => store.isController || isOwner.value)
const paused = computed(() => store.snapshot?.paused ?? false)
const playPauseIcon = computed(() => (paused.value ? 'i-lucide-play' : 'i-lucide-pause'))
const playPauseLabel = computed(() => (paused.value ? 'Resume video for everyone' : 'Pause video for everyone'))
const seekValue = computed(() => (dragging.value ? dragValue.value : store.positionSec))
const muteIcon = computed(() => (store.muted ? 'i-lucide-volume-x' : 'i-lucide-volume-2'))
const muteLabel = computed(() => (store.muted ? 'Unmute video' : 'Mute video'))

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  if (playerSlot.value) sync.attach(playerSlot.value)
  void nextTick(invalidateSeatPositions)
})

onBeforeUnmount(() => {
  sync.detach()
})

onUnmounted(() => {
  invalidateSeatPositions()
})

// The seats move whenever the panel changes height (collapse, or the transport /
// take-over row appearing) — the lucky-fly cache must re-measure.
watch(
  () => [store.collapsed, store.isController, showTakeover.value],
  () => {
    void nextTick(invalidateSeatPositions)
  },
)

// ========================================
// Handlers
// ========================================

async function handleStop(): Promise<void> {
  if (stopping.value) return
  stopping.value = true
  try {
    await stop()
  } finally {
    stopping.value = false
  }
}

async function handleTogglePlay(): Promise<void> {
  if (transportBusy.value) return
  transportBusy.value = true
  try {
    if (paused.value) await resume(sync.currentPosition())
    else await pause(sync.currentPosition())
  } finally {
    transportBusy.value = false
  }
}

/** `input` fires on every drag tick: only track the thumb locally, never emit. */
function handleSeekInput(event: Event): void {
  dragging.value = true
  dragValue.value = seekValueOf(event)
}

/** `change` fires once on release: this is the single seek emit. */
async function handleSeekChange(event: Event): Promise<void> {
  const target = seekValueOf(event)
  dragValue.value = target
  if (transportBusy.value) {
    dragging.value = false
    return
  }
  transportBusy.value = true
  try {
    await seek(target)
  } finally {
    dragging.value = false
    transportBusy.value = false
  }
}

/** A drag that ends with no `change` (cancelled, or released where it began) must not freeze the thumb. */
function handleSeekAbort(): void {
  if (!transportBusy.value) dragging.value = false
}

function openSourceDrawer(): void {
  showSourceDrawer.value = true
}

// ========================================
// Helpers
// ========================================

function seekValueOf(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="room-video-panel" aria-label="Room video">
    <!-- Expanded: the player. v-show (not v-if) so the element survives a collapse. -->
    <div
      v-show="!store.collapsed"
      class="relative w-full aspect-video overflow-hidden rounded-xl bg-black"
    >
      <div ref="playerSlot" class="absolute inset-0" />

      <button
        v-if="store.needsTap"
        type="button"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/60 text-white"
        @click="sync.tapToWatch()"
      >
        <UIcon name="i-lucide-play" class="size-10" />
        <span class="text-sm font-medium">Tap to watch</span>
      </button>

      <div
        v-else-if="store.playbackFailed"
        class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 px-6 text-center text-neutral-300"
      >
        <UIcon name="i-lucide-video-off" class="size-8" />
        <span class="text-sm">Can't play this video on your device.</span>
      </div>

      <div class="absolute right-2 top-2 z-20 flex gap-2">
        <button
          type="button"
          class="room-video-chip"
          :aria-label="muteLabel"
          @click="sync.toggleMuted()"
        >
          <UIcon :name="muteIcon" class="size-4" />
        </button>
        <button
          type="button"
          class="room-video-chip"
          aria-label="Minimise video"
          @click="sync.toggleCollapsed()"
        >
          <UIcon name="i-lucide-chevron-up" class="size-4" />
        </button>
        <button
          v-if="store.isController"
          type="button"
          class="room-video-chip"
          aria-label="Stop video for everyone"
          :disabled="stopping"
          @click="handleStop"
        >
          <UIcon name="i-lucide-square" class="size-4" />
        </button>
      </div>
    </div>

    <!-- Controller transport (expanded only). Nobody else sees controls they cannot use. -->
    <div
      v-if="store.isController"
      v-show="!store.collapsed"
      class="mt-2 flex items-center gap-2 rounded-xl bg-white/10 px-2 py-1 text-white"
    >
      <button
        type="button"
        class="room-video-chip shrink-0"
        :aria-label="playPauseLabel"
        :disabled="transportBusy"
        @click="handleTogglePlay"
      >
        <UIcon :name="playPauseIcon" class="size-4" />
      </button>

      <input
        v-if="store.durationSec > 0"
        type="range"
        class="room-video-seek h-8 min-w-0 flex-1"
        aria-label="Seek video for everyone"
        min="0"
        :max="store.durationSec"
        :step="ROOM_VIDEO_SEEK_STEP_SEC"
        :value="seekValue"
        @input="handleSeekInput"
        @change="handleSeekChange"
        @pointercancel="handleSeekAbort"
        @blur="handleSeekAbort"
      >

      <button type="button" class="room-video-pill ml-auto shrink-0" @click="openSourceDrawer">
        <UIcon name="i-lucide-link" class="size-4" />
        <span>Change link</span>
      </button>
    </div>

    <!-- Owner who is not the Controller: take the video over. -->
    <div v-else-if="showTakeover" v-show="!store.collapsed" class="mt-2 flex justify-end">
      <button type="button" class="room-video-pill" @click="openSourceDrawer">
        <UIcon name="i-lucide-arrow-right-left" class="size-4" />
        <span>Take over</span>
      </button>
    </div>

    <!-- Collapsed: a 40 px bar. -->
    <div
      v-show="store.collapsed"
      class="flex h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-white"
    >
      <span class="room-video-live-dot" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate text-sm" :class="{ 'font-medium': store.needsTap }">{{ collapsedLabel }}</span>
      <button type="button" class="room-video-chip" :aria-label="muteLabel" @click="sync.toggleMuted()">
        <UIcon :name="muteIcon" class="size-4" />
      </button>
      <button type="button" class="room-video-chip" aria-label="Show video" @click="sync.toggleCollapsed()">
        <UIcon name="i-lucide-chevron-down" class="size-4" />
      </button>
    </div>

    <RoomVideoSourceDrawer v-if="canOpenDrawer" v-model:open="showSourceDrawer" />
  </section>
</template>

<style scoped>
.room-video-chip {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.45);
  color: white;
  transition: transform 120ms ease, opacity 120ms ease;
}

.room-video-chip:active,
.room-video-pill:active {
  transform: scale(0.92);
}

.room-video-chip:disabled {
  opacity: 0.5;
}

.room-video-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  padding: 0 0.75rem;
  border-radius: 9999px;
  background: rgb(0 0 0 / 0.45);
  color: white;
  font-size: 0.75rem;
  white-space: nowrap;
  transition: transform 120ms ease, opacity 120ms ease;
}

.room-video-seek {
  accent-color: var(--room-theme, var(--color-primary-500));
}

.room-video-live-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: rgb(239 68 68);
  animation: room-video-live-pulse 1.6s ease-in-out infinite;
}

@keyframes room-video-live-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .room-video-live-dot {
    animation: none;
  }
}
</style>
