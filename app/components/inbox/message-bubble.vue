<script setup lang="ts">
import type { MediaContentPayload, ThreadMessage, VoiceContentPayload } from '~/types/inbox'
import { formatRelativeTime } from '~/utils/date'
import { isMessageSeen } from '~/utils/messageSeenStatus'
import { createLogger } from '~/utils/logger'
import { useVoicePlayback } from '~/composables/inbox/useVoicePlayback'

const log = createLogger('[InboxMessageBubble]')

const props = defineProps<{
  message: ThreadMessage
  /** Peer's thread-level seen watermark (newest message id they've seen), from the store. */
  peerSeenUpToMessageId: string | number | null
}>()
const emit = defineEmits<{
  'long-press': []
  /** In-flight upload cancelled — parent (thread-panel) delegates to useDmComposer.cancelUpload. */
  'cancel-upload': []
  /** Manual retry on a failed bubble, reusing the cached compressed blob. */
  'retry-upload': []
  /** Discard a failed bubble without retrying. */
  'discard-failed': []
  /** Image thumbnail tapped — parent wires this to the lightbox (dm-messenger-v2/03). */
  'open-image': [payload: MediaContentPayload]
}>()

// Seen (peer's watermark has reached this message) vs delivered (readAt fallback
// for self-heal before the first reconcile carries the watermark). Read receipts
// (dm-realtime-platform/08): seen ticks are derived from the thread-level
// watermark, not a per-message flag.
const isSeen = computed(() => isMessageSeen(props.message.id, props.peerSeenUpToMessageId, props.message.readAt))

// Upload lifecycle (dm-messenger-v2/02): optimistic media bubbles carry
// uploadStatus/uploadProgress/localPreviewUrl until they settle into a
// confirmed server message (fields undefined there).
const isUploading = computed(() => props.message.kind === 'media' && props.message.uploadStatus === 'uploading')
const isUploadFailed = computed(() => props.message.kind === 'media' && props.message.uploadStatus === 'failed')

// Media thumbnail (dm-messenger-v2/01): while uploading, prefer the local
// object-URL preview (remote URL doesn't exist yet); once confirmed, parse
// `content`'s JSON payload. Parsed defensively — a stale-OTA/backend
// mismatch degrades to a placeholder rather than crashing the bubble.
const mediaPayload = computed<MediaContentPayload | null>(() => {
  if (props.message.kind !== 'media' || props.message.unsent) return null
  if (props.message.localPreviewUrl) return props.message.media ?? { url: props.message.localPreviewUrl, mimeType: 'image/jpeg' }
  try {
    const parsed = JSON.parse(props.message.content) as Partial<MediaContentPayload>
    if (typeof parsed.url !== 'string' || typeof parsed.mimeType !== 'string') return null
    return parsed as MediaContentPayload
  }
  catch (err) {
    log.warn('Failed to parse media message payload', err)
    return null
  }
})

// Voice payload (dm-messenger-v2/04): parsed defensively same as media —
// a stale-OTA/backend mismatch degrades to the "unknown" placeholder.
const voicePayload = computed<VoiceContentPayload | null>(() => {
  if (props.message.kind !== 'voice' || props.message.unsent) return null
  try {
    const parsed = JSON.parse(props.message.content) as Partial<VoiceContentPayload>
    if (typeof parsed.url !== 'string' || typeof parsed.durationMs !== 'number') return null
    return parsed as VoiceContentPayload
  }
  catch (err) {
    log.warn('Failed to parse voice message payload', err)
    return null
  }
})

// Voice playback derivation (dm-messenger-v2/05): waveform bars, progress,
// remaining time and rate label all come from this composable subscribing
// to the shared engine — component stays INTENT-only.
const {
  barHeights: voiceBarHeights,
  isPlaying: isVoicePlaying,
  progressRatio: voiceProgressRatio,
  remainingMs: voiceRemainingMs,
  rateLabel: voiceRateLabel,
  toggle: toggleVoicePlayback,
  seekToRatio: seekVoicePlayback,
  cycleRate: cycleVoiceRate,
} = useVoicePlayback(String(props.message.id), voicePayload.value?.durationMs ?? 0)

function handleVoiceToggle(): void {
  if (!voicePayload.value) return
  toggleVoicePlayback(voicePayload.value.url)
}

function onWaveformPointerDown(e: PointerEvent): void {
  if (!isVoicePlaying.value) return
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  seekFromPointerEvent(e, target)

  const onMove = (ev: PointerEvent) => seekFromPointerEvent(ev, target)
  const onUp = () => {
    target.removeEventListener('pointermove', onMove)
    target.removeEventListener('pointerup', onUp)
    target.removeEventListener('pointercancel', onUp)
  }
  target.addEventListener('pointermove', onMove)
  target.addEventListener('pointerup', onUp)
  target.addEventListener('pointercancel', onUp)
}

function seekFromPointerEvent(e: PointerEvent, target: HTMLElement): void {
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = (e.clientX - rect.left) / rect.width
  seekVoicePlayback(ratio)
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

// Unified render-kind: any message whose kind isn't text/media/voice (a
// future kind an old OTA bundle doesn't know) or whose payload failed to
// parse renders the same neutral "update your app" placeholder.
type RenderKind = 'text' | 'media' | 'voice' | 'unknown'
const renderKind = computed<RenderKind>(() => {
  if (props.message.unsent) return 'text' // unsent placeholder takes priority in the template
  if (props.message.kind === 'text') return 'text'
  if (props.message.kind === 'media') return mediaPayload.value ? 'media' : 'unknown'
  if (props.message.kind === 'voice') return voicePayload.value ? 'voice' : 'unknown'
  return 'unknown'
})

// Long-press / right-click support
let touchTimer: ReturnType<typeof setTimeout> | null = null

function onTouchStart() {
  touchTimer = setTimeout(() => {
    emit('long-press')
  }, 500)
}

function onTouchEnd() {
  if (touchTimer) {
    clearTimeout(touchTimer)
    touchTimer = null
  }
}

function onContextMenu(e: Event) {
  e.preventDefault()
  emit('long-press')
}
</script>

<template>
  <div
    class="flex mb-1.5 px-3"
    :class="message.isOwn ? 'justify-end' : 'justify-start'"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
    @touchmove.passive="onTouchEnd"
    @contextmenu="onContextMenu"
  >
    <div
      class="max-w-[78%] rounded-2xl text-sm"
      :class="[
        mediaPayload ? 'overflow-hidden p-1' : 'px-3 py-2',
        message.isOwn
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-elevated text-default rounded-bl-sm',
        message.unsent ? 'opacity-70' : '',
      ]"
    >
      <!-- Unsent placeholder -->
      <p v-if="message.unsent" class="leading-snug italic px-2 py-1" :class="message.isOwn ? 'text-white/70' : 'text-muted'">
        <UIcon name="i-lucide-ban" class="size-3 inline mr-1" />This message was deleted
      </p>
      <!-- Media thumbnail: intrinsic-ratio placeholder reserves layout space (no reflow on load); tap opens lightbox (dm-messenger-v2/03 consumes this emit) -->
      <div
        v-else-if="renderKind === 'media'"
        class="relative"
        :style="mediaPayload!.width && mediaPayload!.height ? { aspectRatio: `${mediaPayload!.width} / ${mediaPayload!.height}` } : undefined"
        @click="!isUploading && !isUploadFailed && emit('open-image', mediaPayload!)"
      >
        <img
          :src="mediaPayload!.url"
          :width="mediaPayload!.width"
          :height="mediaPayload!.height"
          loading="lazy"
          class="block max-w-full w-full rounded-xl object-cover"
          :class="isUploading ? 'opacity-60' : ''"
          style="max-height: 320px;"
          alt="Sent image"
        >
        <!-- Uploading: progress ring + cancel -->
        <div v-if="isUploading" class="absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            class="size-11 rounded-full bg-black/50 flex items-center justify-center text-white active:scale-95 transition-transform"
            aria-label="Cancel upload"
            @click.stop="emit('cancel-upload')"
          >
            <span class="text-[10px] font-semibold">{{ message.uploadProgress ?? 0 }}%</span>
          </button>
        </div>
        <!-- Failed: retry / discard -->
        <div v-else-if="isUploadFailed" class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/40 rounded-xl">
          <UIcon name="i-lucide-triangle-alert" class="size-5 text-white" />
          <div class="flex gap-2">
            <button
              type="button"
              class="px-2.5 py-1 rounded-full bg-white/90 text-[10px] font-semibold text-default active:scale-95 transition-transform"
              @click.stop="emit('retry-upload')"
            >
              Retry
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-full bg-white/20 text-[10px] font-semibold text-white active:scale-95 transition-transform"
              @click.stop="emit('discard-failed')"
            >
              Discard
            </button>
          </div>
        </div>
      </div>
      <!-- Voice note: play/pause + waveform scrubber + speed toggle (dm-messenger-v2/05) -->
      <div v-else-if="renderKind === 'voice'" class="flex items-center gap-2 px-1.5 py-1.5 min-w-56">
        <button
          type="button"
          class="size-9 rounded-full flex items-center justify-center shrink-0"
          :class="message.isOwn ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
          :aria-label="isVoicePlaying ? 'Pause voice note' : 'Play voice note'"
          @click="handleVoiceToggle"
        >
          <UIcon :name="isVoicePlaying ? 'i-lucide-pause' : 'i-lucide-play'" class="size-4" />
        </button>
        <div class="flex-1 flex flex-col gap-1 min-w-0">
          <div
            class="relative flex items-end gap-0.5 h-6 py-2 -my-2 cursor-pointer touch-none select-none"
            role="slider"
            tabindex="0"
            :aria-valuenow="Math.round(voiceProgressRatio * 100)"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Seek voice note"
            @pointerdown="onWaveformPointerDown"
          >
            <span
              v-for="(barHeight, index) in voiceBarHeights"
              :key="index"
              class="flex-1 rounded-full transition-colors"
              :class="index / voiceBarHeights.length <= voiceProgressRatio
                ? (message.isOwn ? 'bg-white' : 'bg-primary')
                : (message.isOwn ? 'bg-white/30' : 'bg-primary/25')"
              :style="{ height: `${barHeight}px` }"
            />
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] tabular-nums" :class="message.isOwn ? 'text-white/80' : 'text-muted'">
              {{ formatDuration(isVoicePlaying ? voiceRemainingMs : voicePayload!.durationMs) }}
            </span>
            <button
              v-if="isVoicePlaying"
              type="button"
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none shrink-0"
              :class="message.isOwn ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
              aria-label="Change playback speed"
              @click="cycleVoiceRate"
            >
              {{ voiceRateLabel }}
            </button>
          </div>
        </div>
      </div>
      <!-- Unrecognized kind (stale-OTA safety) or unparseable media/voice payload -->
      <p v-else-if="renderKind === 'unknown'" class="leading-snug italic px-2 py-1" :class="message.isOwn ? 'text-white/70' : 'text-muted'">
        <UIcon name="i-lucide-image-off" class="size-3 inline mr-1" />Update your app to view this message
      </p>
      <!-- Normal content -->
      <p v-else class="allow-copy leading-snug wrap-break-word">{{ message.content }}</p>
      <p
        class="text-[10px] mt-0.5 text-right flex items-center justify-end gap-0.5"
        :class="message.isOwn ? 'text-white/60' : 'text-muted'"
      >
        {{ formatRelativeTime(message.sentAt) }}
        <!-- Read receipt checkmarks -->
        <UIcon
          v-if="message.isOwn && !message.unsent"
          :name="isSeen ? 'i-lucide-check-check' : 'i-lucide-check'"
          :class="isSeen ? 'text-blue-300' : ''"
          class="size-3.5"
        />
      </p>
    </div>
  </div>
</template>
