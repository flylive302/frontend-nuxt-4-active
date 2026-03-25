<script setup lang="ts">
/**
 * RoomSeat - Individual speaker seat component
 * Shows user avatar, name, and audio status indicators
 */
const props = defineProps<{
  seatId: number;
}>();

const seatsStore = useRoomSeatsStore();

// Seat is 0-indexed internally, but seatId prop is 1-indexed
const seatIndex = computed(() => props.seatId - 1);

// Get seat data from store
const seat = computed(() => seatsStore.seats[seatIndex.value]);

// Whether this seat has a user
const isEmpty = computed(() => !seat.value?.user);

// Whether this seat is locked
const isLocked = computed(() => seat.value?.isLocked ?? false);

// Check if this seat is the target of an invite
const isInviteTarget = computed(() => {
  return seatsStore.inviteModeSeat === seatIndex.value;
});

// Whether this seat's user is the active speaker
const isActiveSpeaker = computed(() => seat.value?.isActive ?? false);

// Whether this seat's user is muted
const isMuted = computed(() => seat.value?.isMuted ?? false);

// Open the seat drawer
function openDrawer() {
  seatsStore.openSeat(props.seatId);
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

// Cumulative coin value of gifts received during this session
const seatGiftTotal = computed(() => {
  if (!seat.value?.user) return 0;
  return seatsStore.seatGiftTotals.get(seat.value.user.id) ?? 0;
});
</script>

<template>
  <div
    class="flex flex-col items-center gap-0 h-26 text-center cursor-pointer rounded-xl transition-all duration-300"
    :class="{ 'ring-2 ring-secondary bg-secondary/10 animate-pulse': isInviteTarget }"
    :data-user-id="seat?.user?.id ?? undefined"
    @click="openDrawer"
  >
    <!-- Avatar with audio indicators -->
    <div class="relative w-full">
      <!-- Occupied seat: show user avatar with animation -->
      <UserAvatar v-if="!isEmpty" :animated="true" :frame-asset-url="userFrame" :img="avatarSrc" class="relative z-20" />
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
      <SvgaPlayer v-if="isActiveSpeaker" class="absolute inset-0 z-0 scale-145" name="https://assets.flyliveapp.com/vip/1/mice-wave.svga" />

    </div>

    <p v-if="seat?.user" class="text-xs truncate font-semibold">🪙 {{ formatCurrency(seatGiftTotal) }}</p>

    <p v-if="displayName == props.seatId.toString()" class="text-xs font-semibold w-full leading-none">{{ displayName }}</p>

    <div v-else class="w-full marquee-container">
      <p class="text-xs font-semibold w-full marquee-text leading-none">{{ displayName }}</p>
    </div>

  </div>
</template>