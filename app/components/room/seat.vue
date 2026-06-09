<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
/**
 * RoomSeat - Individual speaker seat component
 * Shows user avatar, name, and audio status indicators
 */
const props = defineProps<{
  seatId: number;
}>();

const seatsStore = useRoomSeatsStore();
const roomStore = useRoomStore();
const membershipStore = useRoomMembershipStore();
const { resolvePropAsset } = usePropLookup();

// Seat is 0-indexed internally, but seatId prop is 1-indexed
const seatIndex = computed(() => props.seatId - 1);

// Get seat data from store (seatsWithUsers provides live user objects)
const seat = computed(() => seatsStore.seatsWithUsers[seatIndex.value]);

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

// Open the seat drawer (store holds 0-indexed seat index)
function openDrawer() {

  seatsStore.openSeat(seatIndex.value);
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
    return undefined;
  }
  return resolvePropAsset(seat.value?.user?.frame_id) ?? undefined;
});

// Mice wave asset — custom if equipped, default otherwise
const miceWaveAsset = computed(() => {
  return resolvePropAsset(seat.value?.user?.mice_wave_id) ?? ASSETS.MICE_WAVE_SVGA;
});

// Display name
const displayName = computed(() => {
  if (isEmpty.value) {
    return isLocked.value ? 'Locked' : `${props.seatId}`;
  }
  const name = seat.value?.user?.name || 'Unknown';
  const isOwner = roomStore.currentRoom?.owner_id === seat.value?.user?.id;
  return isOwner ? `🏠 ${name}` : name;
});

// Cumulative coin value of gifts received during this session
const seatGiftTotal = computed(() => {
  if (!seat.value?.user) return 0;
  return seatsStore.seatGiftTotals.get(seat.value.user.id) ?? 0;
});
</script>

<template>
  <div
    class="flex flex-col items-center min-h-28 text-center cursor-pointer"
    :class="{ 'ring-2 ring-secondary bg-secondary/10 animate-pulse': isInviteTarget }"
    :data-user-id="seat?.user?.id ?? undefined"
    @click="openDrawer"
  >
    <!-- Avatar with audio indicators -->
    <div class="relative w-full">
      <Transition name="seat-pop" mode="out-in">
        <!-- Occupied seat: show user avatar with animation -->
        <UserAvatar
            v-if="!isEmpty"
            key="occupied"
            :animated="true"
            :frame-asset-url="userFrame"
            :img="avatarSrc ?? ASSETS.AVATAR_PLACEHOLDER"
            class="relative z-20"
        />
        <!-- Locked empty seat: show lock image -->
        <UserAvatar
          v-else-if="isLocked"
          key="locked"
          :img="ASSETS.LOCK_SEAT_IMG"
          class="relative z-20"
        />
        <!-- Empty seat: VIP seat image if owner VIP > 11, else default -->
        <UserAvatar
          v-else
          key="empty"
          :img="(roomStore?.currentRoom?.owner?.vip_level ?? 0) > 2 ? `https://ik.imagekit.io/flylive/vip/${roomStore.currentRoom!.owner!.vip_level}/seat.webp` : undefined"
          class="relative z-20"
        />
      </Transition>

      <!-- Mute indicator -->
      <Transition name="seat-fade">
        <UIcon
          v-if="!isEmpty && isMuted"
          name="i-lucide-mic-off"
          class="size-4 text-white absolute bottom-0 -right-1 z-20"
        />
      </Transition>

      <!-- Speaking indicator -->
      <SvgaPlayer v-if="isActiveSpeaker" class="absolute inset-0 scale-150" :name="miceWaveAsset" />

    </div>

    <div class="backdrop-blur-xl rounded-xl w-fit max-w-full px-2 bg-neutral-950/30">
      <MarqueeName
          text-class="text-xs font-semibold text-center drop-shadow-lg leading-none"
          :name="displayName"
      />
    </div>

    <p v-if="seat?.user" class="text-xs min-h-3 truncate font">🪙 {{ formatCurrency(seatGiftTotal) }}</p>

  </div>
</template>

<style scoped>
/* Avatar pop: scale + fade when a user joins or leaves a seat */
.seat-pop-enter-active,
.seat-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.seat-pop-enter-from {
  opacity: 0;
  transform: scale(0.6);
}
.seat-pop-leave-to {
  opacity: 0;
  transform: scale(0.6);
}

/* Mute icon fade */
.seat-fade-enter-active,
.seat-fade-leave-active {
  transition: opacity 0.12s ease;
}
.seat-fade-enter-from,
.seat-fade-leave-to {
  opacity: 0;
}
</style>
