<script setup lang="ts">
const emit = defineEmits<{
  send: [content: string]
}>()

const text = ref('')
const inputRef = ref<{ $el: HTMLElement } | null>(null)

function handleSend(): void {
  const content = text.value.trim()
  if (!content) return
  emit('send', content)
  text.value = ''
  nextTick(() => {
    const el = inputRef.value?.$el?.querySelector('input') as HTMLInputElement | null
    el?.focus()
  })
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="px-3 py-2 border-t border-muted/20 bg-default flex items-center gap-2">
    <UInput
      ref="inputRef"
      v-model="text"
      class="flex-1"
      size="lg"
      placeholder="Message…"
      :ui="{ base: 'rounded-full' }"
      @keydown="handleKeydown"
    />
    <UButton
      icon="i-lucide-send"
      size="sm"
      :disabled="!text.trim()"
      class="shrink-0"
      @click="handleSend"
    />
  </div>
</template>
