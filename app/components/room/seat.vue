<script setup lang="ts">
import { ref } from "vue";

const open = ref(false)
</script>

<template>
  <UDrawer v-model:open="open">
    <div class="flex flex-col items-center gap-0.5 h-21">
      <UserAvatar src="/siteAssets/seats/default-seat.webp" />
      <UButton
          icon="i-lucide-user"
          size="xs"
          variant="soft"
          class="px-1 py-0 rounded-xs text-[8px] truncate w-full"
          :ui="{
          leadingIcon: 'size-[9px]'
        }"
      >
        UserName
      </UButton>
      <UButton
          icon="i-lucide-heart"
          size="xs"
          variant="subtle"
          class="px-1 py-0 rounded-xs text-[8px]"
          :ui="{
          leadingIcon: 'size-[10px]'
        }"
      >
        1
      </UButton>
    </div>

    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-2 pb-4">
        <UButton
            class="w-full justify-center rounded-none"
            size="xl" variant="subtle" color="neutral"
        >
          Move to Seat
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
        <UButton color="neutral" variant="subtle" icon="i-lucide-x" class="justify-center mt-2 shadow-md shadow-neutral-800" @click="open = false">
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>

</template>