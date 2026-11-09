<script setup lang="ts">
// ========================================
// Room Video panel (room-video-player 06)
// ========================================
//
// Mounted by the room page only while a Room Video is live. Expanded = 16:9
// player; collapsed = 40 px bar. Collapse and mute are this Watcher's own
// choices; Stop is the Controller's. The player element itself is owned by
// `useRoomVideoSync` (attached to `playerSlot`), so collapsing only hides it —
// the audio keeps playing, which is what the bar's mute button is for.
//
// Chrome rules (ADR 0040): translucent fills, no backdrop-blur, transitions on
// transform / opacity only.
// ========================================

// ========================================
// State
// ========================================

const playerSlot = ref<HTMLElement | null>(null)
const stopping = ref(false)

// ========================================
// Composables
// ========================================

const store = useRoomVideoStore()
const sync = useRoomVideoSync()
const { stop } = useRoomVideoActions()
const { invalidateSeatPositions } = useLuckyFly()

const title = computed(() => store.snapshot?.title ?? 'Room video')
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

// The seats move whenever the panel changes height — the lucky-fly cache must re-measure.
watch(
  () => store.collapsed,
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

    <!-- Collapsed: a 40 px bar. -->
    <div
      v-show="store.collapsed"
      class="flex h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-white"
    >
      <span class="room-video-live-dot" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate text-sm">{{ title }}</span>
      <button type="button" class="room-video-chip" :aria-label="muteLabel" @click="sync.toggleMuted()">
        <UIcon :name="muteIcon" class="size-4" />
      </button>
      <button type="button" class="room-video-chip" aria-label="Show video" @click="sync.toggleCollapsed()">
        <UIcon name="i-lucide-chevron-down" class="size-4" />
      </button>
    </div>
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

.room-video-chip:active {
  transform: scale(0.92);
}

.room-video-chip:disabled {
  opacity: 0.5;
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
