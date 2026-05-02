<script setup lang="ts">
definePageMeta({ layout: 'alt', middleware: 'auth' })

const { messages, loading, nextCursor, fetchMessages, loadOlder, markRead } = useOfficialMessages()
const scrollEl = ref<HTMLElement | null>(null)

function scrollToBottom(): void {
  nextTick(() => {
    if (!scrollEl.value) return
    scrollEl.value.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'instant' })
  })
}

onMounted(async () => {
  await fetchMessages()
  await markRead()
  scrollToBottom()
})
</script>

<template>
  <main class="flex flex-col h-dvh overflow-hidden">
    <!-- Header -->
    <div class="fixed top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 py-3 bg-background/90 backdrop-blur border-b border-muted/20">
      <UButton
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        to="/inbox"
      />
      <div class="flex items-center gap-2">
        <div class="size-8 rounded-full bg-primary/10 flex items-center justify-center">
          <UIcon name="i-lucide-megaphone" class="size-4 text-primary" />
        </div>
        <div>
          <p class="text-sm font-semibold leading-none">Official</p>
          <p class="text-xs text-muted mt-0.5">Announcements &amp; updates</p>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div ref="scrollEl" class="flex-1 overflow-y-auto pt-20 pb-6 px-4 space-y-3">
      <!-- Loading skeleton -->
      <div v-if="loading && messages.length === 0" class="space-y-3 pt-4">
        <div v-for="i in 5" :key="i" class="animate-pulse">
          <div class="max-w-xs mx-auto h-12 bg-muted/30 rounded-2xl" />
        </div>
      </div>

      <!-- Empty -->
      <div
        v-else-if="messages.length === 0 && !loading"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <div class="size-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <UIcon name="i-lucide-megaphone" class="size-7 text-primary" />
        </div>
        <p class="text-sm text-muted">No official messages yet.</p>
      </div>

      <!-- Load older button -->
      <div v-if="nextCursor" class="flex justify-center pt-2">
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          :loading="loading"
          @click="loadOlder()"
        >
          Load older
        </UButton>
      </div>

      <!-- Message bubbles (oldest first after reversing) -->
      <div
        v-for="msg in [...messages].reverse()"
        :key="msg.id"
        class="flex justify-center"
      >
        <div class="max-w-sm w-full rounded-2xl px-4 py-3 bg-elevated shadow-sm">
          <!-- Targeted badge -->
          <div v-if="msg.isTargeted" class="flex items-center gap-1 mb-1.5">
            <UIcon name="i-lucide-at-sign" class="size-3 text-primary" />
            <span class="text-xs font-medium text-primary">For you</span>
          </div>
          <p class="text-sm leading-relaxed whitespace-pre-wrap">{{ msg.content }}</p>
          <p class="text-xs text-muted mt-1.5 text-right">
            {{ new Date(msg.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </p>
        </div>
      </div>
    </div>
  </main>
</template>
