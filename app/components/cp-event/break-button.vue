<script setup lang="ts">
// Rendered by the parent only when the pair's `can_break` is true. Confirm
// modal first; the pair disappears only after the server confirms (no
// optimistic removal) and the parent's `broken` handler refetches.

const props = defineProps<{
  pairId: number
}>()

const emit = defineEmits<{
  broken: []
}>()

const { breakPair, isBreaking } = useCpActions()

const isOpen = ref(false)

async function confirmBreak(): Promise<void> {
  const done = await breakPair(props.pairId, { onSettled: () => emit('broken') })
  if (done) isOpen.value = false
}

function openConfirm(): void {
  isOpen.value = true
}

function closeConfirm(): void {
  isOpen.value = false
}
</script>

<template>
  <div class="flex justify-center mt-8">
    <UButton color="error" variant="soft" icon="i-lucide-heart-crack" @click="openConfirm">
      Break CP
    </UButton>

    <UModal v-model:open="isOpen">
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold text-white">Break this CP?</h3>
          <p class="text-sm text-neutral-400">
            The pair ends right away and leaves the rankings. Your partner gets a message. This cannot be undone.
          </p>
          <div class="flex justify-end gap-2">
            <UButton color="neutral" variant="ghost" :disabled="isBreaking" @click="closeConfirm">
              Cancel
            </UButton>
            <UButton color="error" :loading="isBreaking" :disabled="isBreaking" @click="confirmBreak">
              Break CP
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
