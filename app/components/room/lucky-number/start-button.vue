<script setup lang="ts">
/**
 * RoomLuckyNumberStartButton — bottom-bar trigger (INTENT only).
 *
 * Rendered only for the Room owner/admin while MSAB has the game on.
 * Disabled during a live round and the cooldown after it; the badge counts
 * both down (primary while live, muted while cooling down). All gating lives
 * in useLuckyNumber; this component just binds.
 */
const { startRound, canSeeStartButton, startGateError, isRoundLive, isCoolingDown, secondsLeft, cooldownSecondsLeft } =
  useLuckyNumber();

const disabled = computed(() => startGateError.value !== null);
</script>

<template>
  <UButton
    v-if="canSeeStartButton"
    size="xl"
    class="p-1 relative"
    :disabled="disabled"
    aria-label="Start Lucky Number round"
    @click="startRound"
  >
    <UIcon class="size-8" name="i-lucide-dices" />
    <span
      v-if="isRoundLive"
      class="absolute -top-2 -right-1 min-w-4 px-1 rounded-full bg-success text-[10px] leading-4 text-white tabular-nums"
    >{{ secondsLeft }}</span>
    <span
      v-else-if="isCoolingDown"
      class="absolute -top-2 -right-1 min-w-4 px-1 rounded-full bg-warrning text-[10px] leading-4 text-white tabular-nums"
    >{{ cooldownSecondsLeft }}</span>
  </UButton>
</template>
