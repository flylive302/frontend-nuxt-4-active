<script setup lang="ts">
/**
 * Framed list row (e.g. the claim dialog's details). A flex line: give the child
 * that should take the slack the `pid-row__grow` class — it truncates with an
 * ellipsis instead of pushing the row wider.
 */
</script>

<template>
  <div class="pid-row">
    <slot />
  </div>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-row {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 50px;
    margin: 6px 0;
    padding: 6px 30px;
    background: var(--pid-img-row) center / 100% 100%;
  }

  .pid-row :deep(.pid-row__grow) {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
