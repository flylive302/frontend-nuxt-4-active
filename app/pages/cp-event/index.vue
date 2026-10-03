<script setup lang="ts">
import { ASSETS } from '~/constants/assets'

definePageMeta({ layout: 'alt', middleware: 'auth' })

const CART_COUNT = 6
</script>

<template>
  <div>
    <NavAlt spacer>CP Event</NavAlt>

    <div class="event">
      <!-- width/height reserve the aspect ratio so the wheel (positioned in % of it) never jumps -->
      <img :src="ASSETS.CP_HEADER" class="header" width="1500" height="2400" alt="">

      <!-- Square box centred on the hub. Paint order = DOM order: stand → rotor → title -->
      <div class="stage">
        <img :src="ASSETS.CP_FERRIS_WHEEL_BOTTOM" class="stand" alt="">
        <div class="rotor">
          <img :src="ASSETS.CP_FERRIS_WHEEL_BASE" class="base" alt="">
          <div
            v-for="i in CART_COUNT"
            :key="i"
            class="seat"
            :style="{ '--a': `${(i * 360) / CART_COUNT}deg` }"
          >
            <div class="relative cart">
              <div class="flex w-full relative justify-center z-10 gap-1 px-1 pt-8">
                <img :src="ASSETS.CP_FERRIS_PLACEHOLDER" class="w-4/10" alt="">
                <img :src="ASSETS.CP_FERRIS_PLACEHOLDER" class="w-4/10" alt="">
              </div>
              <img :src="ASSETS.CP_FERRIS_WHEEL_CART" class="absolute inset-0 z-0" alt="">
            </div>
          </div>
        </div>
        <img :src="ASSETS.CP_FERRIS_WHEEL_TITLE" class="title" alt="">
      </div>
    </div>
  </div>
</template>

<style scoped>
.event {
  position: relative;
  overflow: hidden;
}

.header {
  display: block;
  width: 100%;
  height: auto;
}

.stage {
  --spin: 15s;
  position: absolute;
  top: 55%;
  left: 50%;
  /* 85% cap: a 3/9 o'clock cart reaches 0.585 × width from the hub — keeps it on screen */
  width: min(100% - 50px, 75%);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.stage img {
  display: block;
}

/* Top sits just below the hub so the legs meet behind the title medallion. */
.stand {
  position: absolute;
  top: 90%;
  left: 50%;
  width: 90%;
  transform: translate(-50%, -50%);
}

.rotor {
  position: absolute;
  inset: 0;
  animation: spin var(--spin) linear infinite;
}

.base {
  width: 100%;
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
  width: 100%;
  height: 100%;
  object-fit: contain;
  animation: spin var(--spin) linear infinite reverse;
}

.title {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 55%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
}

@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}
</style>
