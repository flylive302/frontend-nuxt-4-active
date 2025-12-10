<script setup lang="ts">
/**
 * RoomSeat - Individual speaker seat component
 * Shows user avatar, name, and audio status indicators
 */
const props = defineProps<{
  seatId: number;
}>();

const roomStore = useRoomStore();

// Seat is 0-indexed internally, but seatId prop is 1-indexed
const seatIndex = computed(() => props.seatId - 1);

// Get seat data from store
const seat = computed(() => roomStore.seats[seatIndex.value]);

// Whether this seat has a user
const isEmpty = computed(() => !seat.value?.user);

// Whether this seat's user is the active speaker
const isActiveSpeaker = computed(() => seat.value?.isActive ?? false);

// Whether this seat's user is muted
const isMuted = computed(() => seat.value?.isMuted ?? false);

// Open the seat drawer
function openDrawer() {
  roomStore.openSeat(props.seatId);
}

// Avatar source - only set when seat is occupied
const avatarSrc = computed(() => {
  if (isEmpty.value) {
    return undefined; // Don't pass img prop when empty
  }
  return seat.value?.user?.avatar || undefined;
});

// Display name
const displayName = computed(() => {
  if (isEmpty.value) {
    return `Seat ${props.seatId}`;
  }
  return seat.value?.user?.name || 'Unknown';
});
</script>

<template>
  <div
    class="flex flex-col items-center gap-0.5 h-21 text-center cursor-pointer" 
    @click="openDrawer"
  >
    <!-- Avatar with audio indicators -->
    <div class="relative">
      <!-- Occupied seat: show user avatar with animation -->
      <UserAvatar
          v-if="!isEmpty" :animated="true" :class="{
            'ring-2 rounded-full animate-pulse': isActiveSpeaker,
            'ring-primary': isActiveSpeaker && isMuted,
            'ring-success ring-offset-1 ring-offset-black': isActiveSpeaker && !isMuted,
          }" :img="avatarSrc"
      />
      <!-- Empty seat: show default placeholder -->
      <UserAvatar v-else/>

      <!-- Mute indicator -->
      <div v-if="!isEmpty && isMuted" class="absolute -bottom-0.5 -right-0.5 bg-error rounded-full p-0.5">
        <UIcon name="i-lucide-mic-off" class="size-1.5 text-white" />
      </div>

      <!-- Speaking indicator -->
      <div v-if="isActiveSpeaker && !isMuted" class="absolute -bottom-0.5 -right-0.5 bg-success rounded-full p-0.5">
        <UIcon name="i-lucide-volume-2" class="size-1.5 text-white" />
      </div>

      <!-- Empty seat indicator (+ icon overlay) -->
<!--      <div v-if="isEmpty" class="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">-->
<!--        <UIcon name="i-lucide-plus" class="size-4 text-white/60" />-->
<!--      </div>-->
    </div>

    <!-- User name -->
    <UButton
        :icon="isEmpty ? 'i-lucide-user' : (isMuted ? 'i-lucide-mic-off' : 'i-lucide-mic')" size="xs"
      :variant="isEmpty ? 'soft' : 'subtle'" :color="isMuted ? 'error' : 'primary'"
      class="px-1 py-0 rounded-xs text-[8px] truncate w-full justify-center" :ui="{ leadingIcon: 'size-[9px]' }">
      {{ displayName }}
    </UButton>

    <!-- Speaker indicator / seat number -->
    <UButton
        v-if="!isEmpty && seat?.user?.isSpeaker" icon="i-lucide-headphones" size="xs" variant="subtle"
      class="px-1 py-0 rounded-xs text-[8px]" :ui="{ leadingIcon: 'size-[10px]' }">
      Speaker
    </UButton>
  </div>
</template>