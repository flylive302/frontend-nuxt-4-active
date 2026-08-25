<script setup lang="ts">
// ========================================
// Slide Track-Confirm Modal
// ========================================
//
// Shown when a user taps a clickable `track` slide, before navigating into the
// sender's room. INTENT-only: emits confirm/cancel; the gating + navigation live
// in useSlideOverlay. The slide payload carries only the sender's userId, so the
// copy is intentionally generic (no name to display).
// ========================================

const emit = defineEmits<{
  (e: 'confirm' | 'cancel'): void
}>()

const open = defineModel<boolean>('open', { default: false })

// Guard so a confirm-driven close doesn't also fire cancel.
const confirming = ref(false)

function onConfirm(): void {
  confirming.value = true
  emit('confirm')
}

// Closing via backdrop / escape / Cancel button is a cancel.
watch(open, (isOpen) => {
  if (isOpen) {
    confirming.value = false
    return
  }
  if (!confirming.value) emit('cancel')
})
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Visit Room?"
    description="This will take you to the sender's room."
  >
    <template #content>
      <div class="px-4 mt-3 pb-6 space-y-4">
        <div class="flex items-center gap-3 bg-neutral-800 rounded-lg p-3">
          <UIcon name="i-lucide-radio" class="size-8 text-primary shrink-0" />
          <p class="text-sm text-neutral-300">
            You're about to leave this screen and join the sender's room.
          </p>
        </div>

        <UButton
          icon="i-lucide-door-open"
          color="primary"
          size="xl"
          class="w-full justify-center"
          @click="onConfirm"
        >
          Visit Room
        </UButton>

        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="w-full justify-center"
          @click="() => { open = false }"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
