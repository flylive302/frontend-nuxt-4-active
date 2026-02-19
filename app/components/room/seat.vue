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

// Whether this seat is locked
const isLocked = computed(() => seat.value?.isLocked ?? false);

// Check if this seat is the target of an invite
const isInviteTarget = computed(() => {
  // Assuming roomStore.inviteModeSeat is 0-indexed, matching seatIndex
  return roomStore.inviteModeSeat === seatIndex.value;
});

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

// Avatar source - only set when seat is occupied
const userFrame = computed(() => {
  if (isEmpty.value) {
    return undefined; // Don't pass img prop when empty
  }
  return seat.value?.user?.frame || undefined;
});

// Display name+
const displayName = computed(() => {
  if (isEmpty.value) {
    return isLocked.value ? 'Locked' : `${props.seatId}`;
  }
  return seat.value?.user?.name || 'Unknown';
});
</script>

<template>
  <div
    class="flex flex-col items-center gap-0 h-24 text-center cursor-pointer rounded-xl transition-all duration-300"
    :class="{ 'ring-2 ring-cyan-500 bg-cyan-500/10 animate-pulse': isInviteTarget }" @click="openDrawer"
  >
    <!-- Avatar with audio indicators -->
    <div class="relative w-full">
      <!-- Occupied seat: show user avatar with animation -->
      <UserAvatar v-if="!isEmpty" :animated="true" :frame-name="userFrame" :img="avatarSrc" class="relative z-20" />
      <!-- Locked empty seat: show lock image -->
      <UserAvatar
        v-else-if="isLocked"
        img="https://ik.imagekit.io/flylive/siteAssets/seats/lock-seat.webp"
        class="relative z-20"
      />
      <!-- Empty seat: show default placeholder -->
      <UserAvatar v-else class="relative z-20" />

      <!-- Mute indicator -->
      <UIcon
          v-if="!isEmpty && isMuted"
          name="i-lucide-mic-off"
          class="size-4 text-white absolute bottom-0 -right-1 z-20"
      />

      <!-- Speaking indicator -->
      <SvgaPlayer v-if="isActiveSpeaker" class="absolute inset-0 z-0 scale-145" name="https://assets.flyliveapp.com/parsedAnimations/vip/1/mice_wave.json" />

    </div>

    <!-- User name -->
    <p v-if="seat?.user" class="text-xs truncate font-semibold">{{ formatCurrency(seat.user?.charm_xp) }}</p>
    <p class="text-xs truncate font-semibold">{{ displayName }}</p>
  </div>
</template>