<script setup lang="ts">
import { computed } from 'vue'

const roomStore = useRoomStore()

const isOpen = computed({
  get: () => roomStore.activeSeat !== null,
  set: (value) => {
    if (!value) roomStore.closeSeat()
  }
})

const seatId = computed(() => roomStore.activeSeat)
</script>

<template>
  <UDrawer v-model:open="isOpen">
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-2 pb-4">
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Move to Seat {{ seatId }}
        </UButton>
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Invite to Seat
        </UButton>
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Mute Seat
        </UButton>
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Lock Seat
        </UButton>
        <UButton color="neutral" variant="subtle" icon="i-lucide-x" class="justify-center mt-2 shadow-md shadow-neutral-800" @click="isOpen = false">
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
