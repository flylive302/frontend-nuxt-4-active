<script setup lang="ts">
import type { CpWinnerCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'
import { CP_FERRIS_CART_COUNT } from '~/constants/cp-event'
import { winnerToPairCard } from '~/utils/cp'

// Carts fill newest-first from `winners`; unfilled slots render an empty cart.
// Each partner is a CpEventFrame (avatar + static CP ring), same as the podium
// and list; a deleted (null) user becomes winnerToPairCard's placeholder.
const props = defineProps<{
  winners: readonly CpWinnerCard[]
}>()

const carts = computed(() => Array.from({ length: CP_FERRIS_CART_COUNT }, (_, i) => {
  const winner = props.winners[i]
  const pair = winner ? winnerToPairCard(winner) : null
  return {
    angle: `${(i * 360) / CP_FERRIS_CART_COUNT}deg`,
    users: pair ? [pair.binder, pair.partner] : [],
  }
}))
</script>

<template>
  <div class="relative overflow-hidden">
    <!-- width/height reserve the aspect ratio so the wheel (positioned in % of it) never jumps -->
    <img :src="ASSETS.CP_HEADER" class="block h-auto w-full" width="1500" height="2400" fetchpriority="high" alt="">

    <!-- Square box centred on the hub. Paint order = DOM order: stand → rotor → title -->
    <div class="stage">
      <img :src="ASSETS.CP_FERRIS_WHEEL_BOTTOM" class="stand" alt="">
      <div class="rotor">
        <img :src="ASSETS.CP_FERRIS_WHEEL_BASE" class="w-full" alt="">
        <div v-for="(cart, index) in carts" :key="index" class="seat" :style="{ '--a': cart.angle }">
          <div class="cart">
            <!-- one framed avatar per partner (tap → public profile; the stage ignores
                 taps, so they are re-enabled here only); empty slot = bare cart -->
            <div v-if="cart.users.length" class="pointer-events-auto relative z-10 flex w-full justify-center gap-1 pt-5">
              <CpEventFrame v-for="user in cart.users" :key="user.id" :user="user" class="w-full" />
            </div>
            <img :src="ASSETS.CP_FERRIS_WHEEL_CART" class="absolute inset-0 z-0" alt="">
          </div>
        </div>
      </div>
      <img :src="ASSETS.CP_FERRIS_WHEEL_TITLE" class="title" alt="">
    </div>
  </div>
</template>

<style scoped>
/* Hub-anchored boxes: their centre sits on (left 50%, top N%). */
.stage,
.stand,
.title {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
}

.stage {
  --spin: 15s;
  top: 55%;
  /* Capped so the 3/9 o'clock carts stay on screen. */
  width: min(100% - 50px, 75%);
  aspect-ratio: 1;
  pointer-events: none;
}

.stage img {
  display: block;
}

/* Top sits just below the hub so the legs meet behind the title medallion. */
.stand {
  top: 90%;
  width: 90%;
}

.title {
  top: 50%;
  width: 55%;
  aspect-ratio: 1;
}

.rotor {
  position: absolute;
  inset: 0;
  animation: spin var(--spin) linear infinite;
}

/*
 * rotate(a) → out to the rim → rotate(-a): the seat lands on its slot with zero net tilt,
 * so the cart's counter-spin exactly cancels the rotor and every cart stays upright.
 * inset: 0 + margin: auto keeps the seat centred on the hub whatever its size.
 */
.seat {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 34%;
  height: 34%;
  transform: rotate(var(--a)) translateY(-145%) rotate(calc(-1 * var(--a)));
}

.cart {
  position: relative;
  width: 100%;
  height: 100%;
  animation: spin var(--spin) linear infinite reverse;
}

@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}
</style>
