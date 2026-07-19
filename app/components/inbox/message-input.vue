<script setup lang="ts">
// Voice recording (dm-messenger-v2/04): message-input calls useDmComposer
// directly for hold-to-record — it needs the composer's `recording` state
// and the store's `activeThreadId` (thread-panel already sets this on
// mount), the same way pick-image's threadId flows through thread-panel.
// This keeps the component INTENT-only (calls composable methods) without
// requiring a new prop wired through thread-panel.vue.
import { VOICE_SLIDE_TO_CANCEL_THRESHOLD_PX } from '~/constants/inbox'
import { deriveComposerMorphMode, isComposerTextSendable, shouldSendOnKeydown } from '~/utils/dm-composer-input'

const emit = defineEmits<{
  send: [content: string]
  typing: []
  /** Gallery or camera image picked — parent uploads + sends as a media message. */
  'pick-image': [file: File]
}>()

const store = useInboxStore()
const { state: composerState, startRecording, cancelRecording, stopRecording } = useDmComposer()

const text = ref('')
const inputRef = ref<{ $el: HTMLElement } | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const cameraInputRef = ref<HTMLInputElement | null>(null)

const isRecording = computed(() => composerState.value === 'recording')
const morphMode = computed(() => deriveComposerMorphMode(text.value))
const canSend = computed(() => isComposerTextSendable(text.value))
const holdStartX = ref(0)
const slideOffsetX = ref(0)
const willCancel = ref(false)
const elapsedMs = ref(0)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
let holdStartedAt = 0

function handleSend(): void {
  const content = text.value.trim()
  if (!content) return
  emit('send', content)
  text.value = ''
  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('textarea') as HTMLTextAreaElement | null
    el?.focus()
  })
}

function handleKeydown(e: KeyboardEvent): void {
  if (shouldSendOnKeydown(e.key, e.shiftKey)) {
    e.preventDefault()
    handleSend()
  }
}

function handleAttachmentClick(): void {
  fileInputRef.value?.click()
}

function handleCameraClick(): void {
  cameraInputRef.value?.click()
}

function handleFilePicked(e: Event): void {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('pick-image', file)
  input.value = '' // allow re-picking the same file
}

// ── Hold-to-record (mic button, touch + mouse) ─────────────────────────

function startHold(clientX: number): void {
  const threadId = store.activeThreadId
  if (!threadId || canSend.value) return

  holdStartX.value = clientX
  slideOffsetX.value = 0
  willCancel.value = false
  holdStartedAt = Date.now()
  elapsedMs.value = 0
  elapsedTimer = setInterval(() => {
    elapsedMs.value = Date.now() - holdStartedAt
  }, 100)

  void startRecording(threadId)
}

function moveHold(clientX: number): void {
  if (!isRecording.value) return
  const delta = holdStartX.value - clientX // slide left cancels
  slideOffsetX.value = Math.max(0, delta)
  willCancel.value = slideOffsetX.value > VOICE_SLIDE_TO_CANCEL_THRESHOLD_PX
}

function endHold(): void {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = null
  }
  if (!isRecording.value) return

  const threadId = store.activeThreadId
  if (willCancel.value || !threadId) {
    cancelRecording()
  }
  else {
    void stopRecording(threadId)
  }
  slideOffsetX.value = 0
  willCancel.value = false
}

function onMicMouseDown(e: MouseEvent): void {
  startHold(e.clientX)
  const onMove = (ev: MouseEvent) => moveHold(ev.clientX)
  const onUp = () => {
    endHold()
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function onMicTouchStart(e: TouchEvent): void {
  const touch = e.touches[0]
  if (touch) startHold(touch.clientX)
}

function onMicTouchMove(e: TouchEvent): void {
  const touch = e.touches[0]
  if (touch) moveHold(touch.clientX)
}

function onMicTouchEnd(): void {
  endHold()
}

const elapsedLabel = computed(() => {
  const totalSeconds = Math.floor(elapsedMs.value / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
})

onBeforeUnmount(() => {
  if (elapsedTimer) clearInterval(elapsedTimer)
})
</script>

<template>
  <!-- pb is explicit (base + inset) because .safe-area-bottom is unlayered CSS
       and would override py-2's padding-bottom to 0 on web. -->
  <div class="px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-muted/20 bg-default flex items-end gap-2 relative">
    <input
      ref="fileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      @change="handleFilePicked"
    >
    <!-- accept must be the broad image/* here: several Android WebViews ignore
         `capture` (and fall back to the picker) when accept lists specific
         mime types. Post-pick GATE still validates jpeg/png/webp. -->
    <input
      ref="cameraInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="handleFilePicked"
    >

    <!-- Recording overlay: elapsed time + slide-to-cancel hint -->
    <div
      v-if="isRecording"
      class="absolute inset-x-3 top-0 -translate-y-full pb-2 flex items-center justify-between text-xs px-2"
    >
      <span class="flex items-center gap-1.5 text-error font-semibold">
        <span class="size-2 rounded-full bg-error animate-pulse" />
        {{ elapsedLabel }}
      </span>
      <span :class="willCancel ? 'text-error font-semibold' : 'text-muted'">
        {{ willCancel ? 'Release to cancel' : '← Slide to cancel' }}
      </span>
    </div>

    <template v-if="!isRecording">
      <UButton
        icon="i-lucide-image"
        size="sm"
        color="neutral"
        variant="ghost"
        class="shrink-0 size-11 p-0 items-center justify-center"
        aria-label="Attach image"
        @click="handleAttachmentClick"
      />
      <UButton
        icon="i-lucide-camera"
        size="sm"
        color="neutral"
        variant="ghost"
        class="shrink-0 size-11 p-0 items-center justify-center"
        aria-label="Capture photo"
        @click="handleCameraClick"
      />
      <UTextarea
        ref="inputRef"
        v-model="text"
        class="flex-1"
        autoresize
        :rows="1"
        :maxrows="5"
        placeholder="Message…"
        :ui="{ base: 'rounded-2xl resize-none py-2.5' }"
        @keydown="handleKeydown"
        @input="emit('typing')"
      />
    </template>
    <div v-else class="flex-1" />

    <div class="relative shrink-0 size-11">
      <Transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 scale-75"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="transition duration-100 ease-in absolute inset-0"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-75"
      >
        <UButton
          v-if="morphMode === 'send'"
          key="send"
          icon="i-lucide-send"
          size="lg"
          class="size-11 rounded-full"
          :disabled="!canSend"
          aria-label="Send message"
          @click="handleSend"
        />
        <button
          v-else
          key="mic"
          type="button"
          class="size-11 rounded-full flex items-center justify-center transition-colors touch-none select-none"
          :class="isRecording ? 'bg-error text-white' : 'bg-elevated text-default'"
          aria-label="Hold to record a voice note"
          @mousedown.prevent="onMicMouseDown"
          @touchstart.prevent="onMicTouchStart"
          @touchmove.prevent="onMicTouchMove"
          @touchend.prevent="onMicTouchEnd"
          @touchcancel.prevent="onMicTouchEnd"
        >
          <UIcon name="i-lucide-mic" class="size-5" />
        </button>
      </Transition>
    </div>
  </div>
</template>
