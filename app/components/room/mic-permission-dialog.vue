<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

function handleConfirm() {
  ;(document.activeElement as HTMLElement)?.blur()
  emit('update:open', false)
  emit('confirm')
}

function handleCancel() {
  ;(document.activeElement as HTMLElement)?.blur()
  emit('update:open', false)
  emit('cancel')
}

// `prevent-close` blocks Escape, so back must be routed to the cancel path.
useBackDismiss(() => props.open, handleCancel)
</script>

<template>
  <UModal
    :open="open"
    :prevent-close="true"
    title="Microphone Access Required"
    :ui="{
      content: 'bg-neutral-900 border border-white/10',
    }"
    @update:open="$emit('update:open', $event)"
  >
    <template #body>
      <div class="flex flex-col items-center gap-4 py-2">
        <div class="flex items-center justify-center size-16 rounded-full bg-primary/10 border border-primary/20">
          <UIcon name="i-lucide-mic" class="size-8 text-primary" />
        </div>

        <div class="text-center space-y-2">
          <p class="text-sm text-neutral-300 leading-relaxed">
            FlyLive needs access to your microphone so you can speak in audio rooms.
          </p>
          <p class="text-sm text-neutral-400 leading-relaxed">
            Your audio is <span class="text-white font-medium">never recorded or stored</span> — it streams live to other participants only, and disappears the moment you leave.
          </p>
        </div>

        <p class="text-xs text-neutral-500 text-center">
          Your browser will ask you to confirm this permission.
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex gap-3 w-full">
        <UButton
          variant="ghost"
          color="neutral"
          class="flex-1"
          @click="handleCancel"
        >
          Not Now
        </UButton>
        <UButton
          color="primary"
          class="flex-1"
          icon="i-lucide-mic"
          @click="handleConfirm"
        >
          Allow Microphone
        </UButton>
      </div>
    </template>
  </UModal>
</template>
