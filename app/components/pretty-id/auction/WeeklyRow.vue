<script setup lang="ts">
/**
 * One row of the Weekly Record: the week's date range, the ID on a small plate,
 * its holder, and the holder's signature on a paper slip (left out when the
 * allotment has none).
 */
import type { PrettyIdAllotment } from '~/types/pretty-id'
import { formatPrettyIdDate } from '~/utils/pretty-id-format'

// Config
defineProps<{
  allotment: PrettyIdAllotment
}>()

// Constants
const AVATAR_SIZE = 30
</script>

<template>
  <PrettyIdRow class="gap-1.5!">
    <span class="pid-body w-[62px] flex-none text-[10px] leading-[1.3]">
      {{ formatPrettyIdDate(allotment.week_start) }}<br>{{ formatPrettyIdDate(allotment.week_end) }}
    </span>
    <PrettyIdPlate class="min-w-12! px-3.5! py-[3px]!">
      <span class="pid-num pid-gold text-[13px]">{{ allotment.id_number }}</span>
    </PrettyIdPlate>
    <PrettyIdRing :src="allotment.user.avatar_url" :size="AVATAR_SIZE" />
    <span class="pid-body pid-row__grow text-[11px]">{{ allotment.user.name }}</span>
    <!-- Two elements: the slip art and the gold foil are both backgrounds, so one element cannot carry both. -->
    <span v-if="allotment.signature_text" class="pid-slip">
      <span class="pid-gold pid-slip__text">{{ allotment.signature_text }}</span>
    </span>
  </PrettyIdRow>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-slip {
    flex: none;
    max-width: 110px;
    padding: 2px 10px;
    background: var(--pid-img-slip) center / 100% 100%;
  }

  /* Great Vibes ships a single 400 weight; the theme's 600 would be faux-bolded. */
  .pid-slip__text {
    display: block;
    overflow: hidden;
    font: 400 20px var(--pid-font-script);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
