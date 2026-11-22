<script setup lang="ts">
/**
 * The "Hall of Numbers" hero: the lion poster with the looping SVGA on top.
 *
 * Full height (750x1000) on the Choose tab, cropped to a 750x620 band on the
 * other tabs. It is ONE mounted instance for the whole tab layout — `compact`
 * only changes the crop, so the 3.8 MB animation is parsed once and keeps
 * playing across tab switches.
 */
import { PRETTY_ID_ASSETS } from '~/constants/assets'

defineProps<{
  compact: boolean
}>()
</script>

<template>
  <div class="pid-hero" :class="{ 'pid-hero--compact': compact }">
    <div class="pid-hero__stage">
      <PrettyIdAnimation :src="PRETTY_ID_ASSETS.heroSvga" :poster="PRETTY_ID_ASSETS.heroPoster" />
    </div>
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* Pulls up under the sticky top bar: 54px (38px button + 2 x 8px padding) plus
     the status-bar inset the bar pads itself down by on native. */
  .pid-hero {
    position: relative;
    width: 100%;
    margin-top: calc(-54px - env(safe-area-inset-top, 0px));
    overflow: hidden;
    aspect-ratio: 750 / 1000;
    background: var(--pid-bg);
  }

  .pid-hero--compact {
    aspect-ratio: 750 / 620;
  }

  /* The stage always keeps the full 750x1000 frame; compact slides it up 12% so
     the crop lands on the lion and the title. */
  .pid-hero__stage {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    aspect-ratio: 750 / 1000;
  }

  .pid-hero--compact .pid-hero__stage {
    top: -12%;
  }

  /* Melt the cropped edge into the marble below. */
  .pid-hero--compact::after {
    content: '';
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 22%;
    background: linear-gradient(#26103a00, var(--pid-bg));
  }
}
</style>
