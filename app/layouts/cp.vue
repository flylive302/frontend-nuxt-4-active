<script setup lang="ts">
const { winners } = useCpHero()
</script>

<template>
  <div>
    <!-- .cp-nav / .cp-shell are pinned during sibling-tab View Transitions (main.css,
         data-nav-shell="cp"): they hold still while only the <slot/> content slides. -->
    <div class="cp-nav">
      <NavAlt spacer>CP Event</NavAlt>
    </div>

    <div class="cp-shell bg-primary-300">
      <CpEventFerrisWheel :winners="winners" />
      <CpEventCountdown class="relative -mt-20" />
      <CpEventTabs />
    </div>

    <div class="relative px-3 bg-primary-300">
      <slot />
    </div>
  </div>
</template>
