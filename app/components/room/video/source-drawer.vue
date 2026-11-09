<script setup lang="ts">
import { parseVideoSource } from '~/utils/video-source'
import type { VideoSourceError } from '~/types/room/video'

// ========================================
// Room Video Source Drawer
// ========================================
//
// Owner / admin pastes an .mp4 or .m3u8 link (or a YouTube link, which parses
// but cannot start yet). Shows a live preview of what the link was recognised
// as, and a Start button.
//
// INTENT only: `useRoomVideoActions().start()` owns the real parse, the gate
// and the socket emit. The preview below is display-only.
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

const canStart = computed(() => preview.value.state === 'ready' && !isStarting.value)

// ========================================
// Composables
// ========================================

const { start } = useRoomVideoActions()

// ========================================
// Handlers
// ========================================

async function handleStart(): Promise<void> {
  if (!canStart.value) return
  isStarting.value = true
  try {
    const started = await start(text.value)
    if (!started) return
    text.value = ''
    open.value = false
  } finally {
    isStarting.value = false
  }
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
              @keydown.enter="handleStart"
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

        <UButton
          block
          size="xl"
          icon="i-lucide-play"
          :loading="isStarting"
          :disabled="preview.state !== 'ready'"
          @click="handleStart"
        >
          Start
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
