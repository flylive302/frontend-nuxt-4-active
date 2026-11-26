<script setup lang="ts">
/**
 * Live `[2D ]HH:MM:SS` countdown to a server timestamp, in the event's gold
 * numerals. Ticks off the shared server-adjusted clock, so every countdown on
 * screen repaints from one interval and agrees with the server's idea of now.
 * Past the target it stays at 00:00:00.
 */
import { formatPrettyIdDuration } from '~/utils/pretty-id-format'

const props = defineProps<{
  /** ISO-8601 target time. */
  to: string
}>()

const { now } = usePrettyIdClock()

const label = computed(() => formatPrettyIdDuration(Date.parse(props.to) - now.value))
</script>

<template>
  <span class="pid-num pid-gold tabular-nums" role="timer">{{ label }}</span>
</template>
