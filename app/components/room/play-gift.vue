<script setup lang="ts">
//Play Gift Model : play-gift.vue -> Component
import { ref, watch, onBeforeUnmount } from "vue"
import { useRoomAudio } from "~/composables/useRoomAudio";
const { sendGift } = useRoomAudio();

// ────────────────────────────────────────────
// Props
// ────────────────────────────────────────────
const props = withDefaults(
  defineProps<{
    category?: string
    name?: string
    label?: string
    price?: number
    autoCloseMs?: number
    selectedGiftId?: number
    selectedRecipients?: number[] | undefined
  }>(),
  {
    category: "normal",
    name: "castle",
    label: "Castle",
    price: 3000,
    autoCloseMs: 4000,
    selectedGiftId: undefined,
    selectedRecipients: () => []
  }
)



// ────────────────────────────────────────────
// Reactive State
// ────────────────────────────────────────────
const giftName = ref(`gifts/${props.category}/${props.name}/${props.name}`)
const quantityOptions = ref([1, 7, 17, 77, 777, 1777])
const selectedQuantity = ref(1)

const isGiftPlaying = ref(false)
const comboLoopCount = ref(1)
const progressPercent = ref(0)
const showComboButton = ref(false)

// Timers
let autoCloseTimeoutId: number | null = null
let animationFrameId: number | null = null

// ────────────────────────────────────────────
// Animation
// ────────────────────────────────────────────
function startComboProgress(durationMs: number) {
  // Cancel existing animation loop
  if (animationFrameId) cancelAnimationFrame(animationFrameId)

  progressPercent.value = 0
  const startTime = performance.now()

  const update = (currentTime: number) => {
    const elapsedMs = currentTime - startTime
    const progressRatio = Math.min(elapsedMs / durationMs, 1)

    progressPercent.value = Math.round(progressRatio * 100)

    if (progressRatio < 1) {
      animationFrameId = requestAnimationFrame(update)
    } else {
      animationFrameId = null
      // CRITICAL FIX: Hide combo button when animation completes
      showComboButton.value = false
    }
  }

  animationFrameId = requestAnimationFrame(update)
}

// ────────────────────────────────────────────
// Combo Button Handler
// ────────────────────────────────────────────
function handleComboClick(event: Event) {
  // CRITICAL FIX: Stop event propagation to prevent closing parent drawer
  event.stopPropagation()
  event.preventDefault()

  comboLoopCount.value++
  startComboProgress(3000)
}

// ────────────────────────────────────────────
// Modal Watcher — handles auto-close + animation
// ────────────────────────────────────────────
watch(isGiftPlaying, (opened) => {
  if (!opened) {
    if (autoCloseTimeoutId) clearTimeout(autoCloseTimeoutId)
    // CRITICAL FIX: Hide combo button when modal closes
    showComboButton.value = false
    return
  }

  // CRITICAL FIX: Show combo button immediately when modal opens
  showComboButton.value = true

  // Auto-close timer
  autoCloseTimeoutId = window.setTimeout(() => {
    isGiftPlaying.value = false
  }, props.autoCloseMs)

  // Progress animation
  startComboProgress(3000)
})

// ────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────
onBeforeUnmount(() => {
  if (autoCloseTimeoutId) clearTimeout(autoCloseTimeoutId)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})


// Emit event to notify parent to reset selection
const emit = defineEmits<{
  (e: 'giftSent'): void
}>()

// Send gift to selected recipients
function handleSendGift() {
  if (!props.selectedGiftId || !props.selectedRecipients?.length) {
    return;
  }
  // Send gift to each selected recipient
  props.selectedRecipients.forEach((recipientId: number) => {
    sendGift(props.selectedGiftId!, recipientId, Number(selectedQuantity.value));
  });

  // Reset local quantity and notify parent to reset selection
  selectedQuantity.value = 1;
  emit('giftSent');
}
</script>

<template>
  <div class="flex items-center justify-between my-2">
    <div class="flex items-center">
      <UButton icon="i-lucide-coins" variant="ghost" color="success" size="md" class="text-white">
        598
      </UButton>

      <UButton variant="subtle" color="success" size="xs" class="rounded-full">
        Recharge
      </UButton>
    </div>

    <!-- ======================================================
         GLOBAL ALWAYS-CLICKABLE COMBO BUTTON (Teleported)
         ====================================================== -->
    <Teleport to="body">
      <div v-show="showComboButton" class="fixed bottom-4 right-4 z-[999999] size-20 flex items-center justify-center">
        <svg class="absolute inset-0 size-20 -rotate-90" viewBox="0 0 36 36">
          <circle cx="18" cy="18" r="16" stroke="rgba(255,255,255,0.25)" stroke-width="3" fill="none" />
          <circle
cx="18" cy="18" r="16" stroke="var(--ui-primary)" stroke-width="3" fill="none" stroke-linecap="round"
            :style="{ strokeDasharray: 100, strokeDashoffset: 100 - progressPercent }" />
        </svg>

        <UButton square class="rounded-full size-16 font-bold text-sm relative" @click="handleComboClick">
          Combo {{ progressPercent }}
        </UButton>
      </div>
    </Teleport>

    <!-- Modal -->
    <UModal
v-model:open="isGiftPlaying" fullscreen :dismissible="false" :overlay="false"
      :ui="{ content: 'bg-transparent !z-0 border-none rounded-none !pointer-events-none' }">
      <!-- Send Button -->
      <UFieldGroup size="xs">
        <USelect v-model="selectedQuantity" class="w-15" size="xs" :items="quantityOptions" />
        <UButton
:disabled="!selectedGiftId || (selectedRecipients?.length ?? 0) === 0" size="xs" trailing-icon="i-lucide-send"
          @click="handleSendGift">
          Send
        </UButton>
      </UFieldGroup>

      <template #content>
        <div class="min-h-screen relative">
          <LazySvgaPlayer class="relative min-w-full z-10" height="auto" :name="giftName" :loop="comboLoopCount" />
        </div>
      </template>
    </UModal>
  </div>
</template>