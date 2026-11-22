<script setup lang="ts">
/**
 * Layout of the three Pretty ID tabs (/pretty-id, /pretty-id/auction,
 * /pretty-id/my): top bar, hero and tab row stay mounted while only the
 * <slot/> swaps.
 */
import { PRETTY_ID_EXIT_ROUTE, PRETTY_ID_ROUTES } from '~/constants/pretty-id'

const route = useRoute()

/** Full-height hero on Choose, cropped band on the other two tabs. */
const isHeroCompact = computed(() => route.path.replace(/\/+$/, '') !== PRETTY_ID_ROUTES.choose)
</script>

<template>
  <PrettyIdShell>
    <!-- .pretty-id-topbar / .pretty-id-shell are pinned during sibling-tab View
         Transitions (main.css, data-nav-shell="pretty-id"): they hold still while
         only the <slot/> content slides. -->
    <PrettyIdTopBar class="pretty-id-topbar" :back-to="PRETTY_ID_EXIT_ROUTE" />

    <div class="pretty-id-shell">
      <PrettyIdHero :compact="isHeroCompact" />
      <PrettyIdTabs />
    </div>

    <div class="pid-sec">
      <slot />
    </div>
  </PrettyIdShell>
</template>
