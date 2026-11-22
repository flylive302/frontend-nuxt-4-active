<script setup lang="ts">
/**
 * Shown by <PrettyIdShell> in place of the page when the event's first load
 * failed: without `me` (level, balance, rules) no Pretty ID screen can render.
 * Offers a retry and the way out — the layout's own top bar is not mounted here.
 */
import { PRETTY_ID_EXIT_ROUTE } from '~/constants/pretty-id'

defineProps<{
  /** A retry is in flight. */
  retrying: boolean
}>()

const emit = defineEmits<{
  retry: []
}>()

function leave(): void {
  void navigateTo(PRETTY_ID_EXIT_ROUTE)
}
</script>

<template>
  <div class="safe-area-top flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center" role="alert">
    <p class="pid-disp pid-gold text-[22px]">Hall of Numbers</p>
    <p class="pid-body">We couldn't load the event. Check your connection and try again.</p>
    <div class="flex flex-wrap justify-center gap-2.5">
      <PrettyIdButton size="sm" @click="leave">Back</PrettyIdButton>
      <PrettyIdButton size="sm" :disabled="retrying" @click="emit('retry')">
        {{ retrying ? 'Loading…' : 'Try again' }}
      </PrettyIdButton>
    </div>
  </div>
</template>
