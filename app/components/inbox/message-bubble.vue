<script setup lang="ts">
import type { ThreadMessage } from '~/types/inbox'
import { formatRelativeTime } from '~/utils/date'

defineProps<{ message: ThreadMessage }>()
</script>

<template>
  <div
    class="flex mb-1.5 px-3"
    :class="message.isOwn ? 'justify-end' : 'justify-start'"
  >
    <div
      class="max-w-[78%] px-3 py-2 rounded-2xl text-sm"
      :class="
        message.isOwn
          ? 'bg-primary text-white rounded-br-sm'
          : 'bg-elevated text-default rounded-bl-sm'
      "
    >
      <p class="leading-snug wrap-break-word">{{ message.content }}</p>
      <p
        class="text-[10px] mt-0.5 text-right"
        :class="message.isOwn ? 'text-white/60' : 'text-muted'"
      >
        {{ formatRelativeTime(message.sentAt) }}
      </p>
    </div>
  </div>
</template>
