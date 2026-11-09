<script setup lang="ts">
import { parseVideoSource } from '~/utils/video-source'
import type { RoomMediaSlotKind, VideoSourceError } from '~/types/room/video'

// ========================================
// Room Video Source Drawer
// ========================================
//
// Owner / admin pastes an .mp4 or .m3u8 link (or a YouTube link, which parses
// but cannot start yet). Shows a live preview of what the link was recognised
// as, and a Start button.
//
// Take over (owner only): when a Room Video is live under someone else, Start
// reads "Take over" and force-takes the room. When Start meets a busy media slot
// (someone's music or video) the owner is shown why plus a "Take over" button;
// an admin just gets the toast from `start()`.
//
// INTENT only: `useRoomVideoActions()` owns the real parse, the gate and the
// socket emit. The preview below is display-only.
// ========================================

// ========================================
// Config
// ========================================

const open = defineModel<boolean>('open', { default: false })

// ========================================
// Constants
// ========================================

const PLACEHOLDER = 'Paste an .mp4 or .m3u8 link'

const YOUTUBE_SOON_MESSAGE = 'YouTube links are coming soon.'

/** One plain-English line per refusal. `empty` is never shown (nothing typed yet). */
const ERROR_MESSAGES: Record<VideoSourceError, string> = {
  empty: 'Paste a link to get started.',
  too_long: 'That link is too long.',
  invalid_url: 'That does not look like a link.',
  not_https: 'The link must start with https://.',
  unsupported_scheme: 'Only https:// links work.',
  youtube_playlist: 'That is a playlist. Paste a link to one video.',
  youtube_channel: 'That is a channel page. Paste a link to one video.',
  not_media: 'The link must end in .mp4 or .m3u8.',
}

const CONTAINER_LABELS = { mp4: 'MP4 video', hls: 'HLS stream' } as const

/** Why the owner's Start was refused. */
const BUSY_REASONS: Record<RoomMediaSlotKind, string> = {
  music: 'Music is playing.',
  video: 'Another video is playing.',
}
const BUSY_REASON_UNKNOWN = 'Something else is playing.'
const TAKEOVER_HINT = 'Taking over stops it for everyone.'

// ========================================
// Types
// ========================================

type SourcePreview =
  | { state: 'idle' }
  | { state: 'ready'; label: string; host: string }
  | { state: 'soon'; message: string }
  | { state: 'error'; message: string }

// ========================================
// State
// ========================================

const text = ref('')
const isStarting = ref(false)
const isTakingOver = ref(false)
/** Set when Start hit a busy slot as the owner; `heldBy` is absent if the server did not say. */
const takeoverOffer = ref<{ heldBy?: RoomMediaSlotKind } | null>(null)

const preview = computed<SourcePreview>(() => {
  if (text.value.trim() === '') return { state: 'idle' }
  const parsed = parseVideoSource(text.value)
  if (!parsed.ok) return { state: 'error', message: ERROR_MESSAGES[parsed.error] }
  if (parsed.source.kind === 'youtube') return { state: 'soon', message: YOUTUBE_SOON_MESSAGE }
  return {
    state: 'ready',
    label: CONTAINER_LABELS[parsed.source.container],
    host: hostOf(parsed.source.url),
  }
})

const canStart = computed(() => preview.value.state === 'ready' && !isStarting.value && !isTakingOver.value)

// ========================================
// Composables
// ========================================

const store = useRoomVideoStore()
const { myRank } = useRoomHierarchy()
const { start, takeover } = useRoomVideoActions()

/** A video is live under someone else and I own the room: the primary button takes over. */
const takeoverMode = computed(() => store.isActive && myRank.value === 'owner' && !store.isController)
const primaryLoading = computed(() => (takeoverMode.value ? isTakingOver.value : isStarting.value))
const busyReason = computed(() => {
  const offer = takeoverOffer.value
  if (offer === null) return ''
  return offer.heldBy ? BUSY_REASONS[offer.heldBy] : BUSY_REASON_UNKNOWN
})

// A stale "busy" offer must not outlive the link it was about, or the drawer.
watch(text, () => {
  takeoverOffer.value = null
})
watch(open, isOpen => {
  if (!isOpen) takeoverOffer.value = null
})

// ========================================
// Handlers
// ========================================

function finish(): void {
  text.value = ''
  takeoverOffer.value = null
  open.value = false
}

async function handleStart(): Promise<void> {
  if (!canStart.value) return
  isStarting.value = true
  try {
    const result = await start(text.value)
    if (result.ok) {
      finish()
      return
    }
    if (result.canTakeOver) takeoverOffer.value = { heldBy: result.heldBy }
  } finally {
    isStarting.value = false
  }
}

async function handleTakeover(): Promise<void> {
  if (!canStart.value) return
  isTakingOver.value = true
  try {
    if (await takeover(text.value)) finish()
  } finally {
    isTakingOver.value = false
  }
}

function handlePrimary(): Promise<void> {
  return takeoverMode.value ? handleTakeover() : handleStart()
}

// ========================================
// Helpers
// ========================================

function hostOf(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ''
  }
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Video"
    description="Play a video for everyone in the room."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4 max-h-[80vh] overflow-y-auto">
        <div class="bg-neutral-800 rounded-lg p-3 space-y-3">
          <UFormField label="Video link">
            <UInput
              v-model="text"
              :placeholder="PLACEHOLDER"
              icon="i-lucide-link"
              size="xl"
              class="w-full"
              inputmode="url"
              autocomplete="off"
              autocapitalize="off"
              :spellcheck="false"
              @keydown.enter="handlePrimary"
            />
          </UFormField>

          <p
            v-if="preview.state !== 'idle'"
            class="flex items-center gap-2 text-xs"
            :class="{
              'text-primary': preview.state === 'ready',
              'text-neutral-300': preview.state === 'soon',
              'text-error': preview.state === 'error',
            }"
            aria-live="polite"
          >
            <template v-if="preview.state === 'ready'">
              <UIcon name="i-lucide-circle-check" class="size-4 shrink-0" />
              <span class="min-w-0 truncate">
                {{ preview.label }}<template v-if="preview.host"> · {{ preview.host }}</template>
              </span>
            </template>
            <template v-else>
              <UIcon
                :name="preview.state === 'soon' ? 'i-lucide-clock' : 'i-lucide-circle-alert'"
                class="size-4 shrink-0"
              />
              <span>{{ preview.message }}</span>
            </template>
          </p>
        </div>

        <p v-if="takeoverMode" class="text-xs text-neutral-300">
          {{ TAKEOVER_HINT }}
        </p>

        <UButton
          block
          size="xl"
          :icon="takeoverMode ? 'i-lucide-arrow-right-left' : 'i-lucide-play'"
          :loading="primaryLoading"
          :disabled="preview.state !== 'ready'"
          @click="handlePrimary"
        >
          {{ takeoverMode ? 'Take over' : 'Start' }}
        </UButton>

        <!-- Start met a busy media slot and I own the room: say why, offer the takeover. -->
        <div v-if="takeoverOffer !== null" class="bg-neutral-800 rounded-lg p-3 space-y-2" aria-live="polite">
          <p class="flex items-center gap-2 text-sm text-warning">
            <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" />
            <span>{{ busyReason }}</span>
          </p>
          <p class="text-xs text-neutral-300">
            {{ TAKEOVER_HINT }}
          </p>
          <UButton
            block
            size="xl"
            color="warning"
            variant="soft"
            icon="i-lucide-arrow-right-left"
            :loading="isTakingOver"
            :disabled="!canStart"
            @click="handleTakeover"
          >
            Take over
          </UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>
