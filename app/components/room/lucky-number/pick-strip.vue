<script setup lang="ts">
/**
 * RoomLuckyNumberPickStrip — numbers 1–9 in the bottom bar (INTENT only).
 *
 * Shown in place of the normal bottom-bar row for seated users while a round
 * is live (the page owns that swap). The highlighted number is the viewer's
 * last tap; the ✓ on their Seat comes from `luckyNumber:picked`, not from here.
 */
import { LUCKY_NUMBER_CHOICES } from '~/constants/lucky-number';

const { pick, myPick, secondsLeft } = useLuckyNumber();
</script>

<template>
  <div
    class="flex items-center gap-1 py-1 mb-24 shadow-md ring ring-primary/30 rounded-lg bg-primary/10 px-2"
    role="group"
    aria-label="Pick your lucky number"
  >
    <span class="shrink-0 w-6 text-center text-md font-bold tabular-nums text-primary">{{ secondsLeft }}</span>
    <div class="flex flex-1 justify-between gap-1">
      <UButton
        v-for="n in LUCKY_NUMBER_CHOICES"
        :key="n"
        size="lg"
        :variant="myPick === n ? 'outline' : 'solid'"
        class="flex-1 min-w-0 justify-center px-0 font-bold tabular-nums"
        :aria-pressed="myPick === n"
        :aria-label="`Pick ${n}`"
        @click="pick(n)"
      >
        {{ n }}
      </UButton>
    </div>
  </div>
</template>
