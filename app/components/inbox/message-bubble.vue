<script setup lang="ts">
import type { ThreadMessage } from '~/types/inbox'
import { formatRelativeTime } from '~/utils/date'

defineProps<{ message: ThreadMessage }>()
const emit = defineEmits<{ 'long-press': [] }>()

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
      class="max-w-[78%] px-3 py-2 rounded-2xl text-sm"
      :class="[
        message.isOwn
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-elevated text-default rounded-bl-sm',
        message.unsent ? 'opacity-70' : '',
      ]"
    >
      <!-- Unsent placeholder -->
      <p v-if="message.unsent" class="leading-snug italic" :class="message.isOwn ? 'text-white/70' : 'text-muted'">
        <UIcon name="i-lucide-ban" class="size-3 inline mr-1" />This message was deleted
      </p>
      <!-- Normal content -->
      <p v-else class="leading-snug wrap-break-word">{{ message.content }}</p>
      <p
        class="text-[10px] mt-0.5 text-right flex items-center justify-end gap-0.5"
        :class="message.isOwn ? 'text-white/60' : 'text-muted'"
      >
        {{ formatRelativeTime(message.sentAt) }}
        <!-- Read receipt checkmarks -->
        <UIcon
          v-if="message.isOwn && !message.unsent"
          :name="message.readAt ? 'i-lucide-check-check' : 'i-lucide-check'"
          :class="message.readAt ? 'text-blue-300' : ''"
          class="size-3.5"
        />
      </p>
    </div>
  </div>
</template>
