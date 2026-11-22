<script setup lang="ts">
/**
 * The demo panel: a bottom sheet of test levers for the mock backend, opened by
 * the gear in the top bar. Renders nothing once the real API replaces the mock
 * (the composable then reports it unavailable). Mounted once by <PrettyIdShell>.
 */
import { usePrettyIdStore } from '~/stores/prettyId'

const store = usePrettyIdStore()
const devPanel = usePrettyIdDevPanel()
</script>

<template>
  <PrettyIdSheet
    v-if="devPanel.isAvailable"
    :open="store.isDevPanelOpen"
    title="Demo Panel"
    @close="devPanel.close()"
  >
    <PrettyIdDevPanelBody @close="devPanel.close()" />
  </PrettyIdSheet>
</template>
