<script setup lang="ts">
/**
 * Layout of the Pretty ID sub-pages (the search result): the event frame and
 * top bar only — no hero, no tab row. Back pops history to the tab the user
 * came from.
 *
 * A separate layout from `pretty-id` on purpose: the tab layout's chrome is
 * pinned during sibling-tab View Transitions, and a page without that chrome
 * must not share its layout name (middleware/shell-transition.global.ts).
 *
 * Pages own their gutter (`pid-sec`), so one can run a band edge to edge.
 */
</script>

<template>
  <PrettyIdShell>
    <PrettyIdTopBar />
    <slot />
  </PrettyIdShell>
</template>
