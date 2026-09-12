<script setup lang="ts">
/**
 * RoomLuckyNumberStartButton — bottom-bar trigger (INTENT only).
 *
 * Rendered only for the Room owner/admin while MSAB has the game on.
 * Disabled during a live round and the cooldown after it. All gating lives
 * in useLuckyNumber; this component just binds.
 */
const { startRound, canSeeStartButton, startGateError, isRoundLive, secondsLeft } = useLuckyNumber();

const disabled = computed(() => startGateError.value !== null);
</script>

<template>
  <UButton
    v-if="canSeeStartButton"
    size="xl"
    variant="ghost"
    class="p-0 text-primary relative"
    :disabled="disabled"
    aria-label="Start Lucky Number round"
    @click="startRound"
  >
    <UIcon class="size-8" name="i-lucide-dices" />
    <span
      v-if="isRoundLive"
      class="absolute -top-1 -right-1 min-w-4 px-1 rounded-full bg-primary text-[10px] leading-4 text-white tabular-nums"
    >{{ secondsLeft }}</span>
  </UButton>
</template>
