<script setup lang="ts">
const props = defineProps<{
  seatId: number
}>()

const roomStore = useRoomStore()

const openDrawer = () => {
  roomStore.openSeat(props.seatId)
}
</script>

<template>
  <div class="flex flex-col items-center gap-0.5 h-21 text-center" @click="openDrawer">
    <UserAvatar src="/siteAssets/seats/default-seat.webp" />
    <UButton
        icon="i-lucide-user"
        size="xs"
        variant="soft"
        class="px-1 py-0 rounded-xs text-[8px] truncate w-full justify-center"
        :ui="{ leadingIcon: 'size-[9px]' }"
    >
      User {{ seatId }}
    </UButton>
    <UButton
        icon="i-lucide-heart"
        size="xs"
        variant="subtle"
        class="px-1 py-0 rounded-xs text-[8px]"
        :ui="{ leadingIcon: 'size-[10px]' }"
    >
      1
    </UButton>
  </div>
</template>