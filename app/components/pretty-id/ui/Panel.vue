<script setup lang="ts">
/**
 * The gold-framed marble panel every Pretty ID section sits in: 9-slice gold
 * border, a finial top and bottom, a crystal corner on each angle and an
 * optional title plaque riding the top edge.
 */
defineProps<{
  /** Text on the title plaque. Omit for an untitled panel. */
  title?: string
}>()
</script>

<template>
  <section class="pid-panel" :class="{ 'pid-panel--titled': title }">
    <i class="pid-panel__corner pid-panel__corner--tl" aria-hidden="true" />
    <i class="pid-panel__corner pid-panel__corner--tr" aria-hidden="true" />
    <i class="pid-panel__corner pid-panel__corner--bl" aria-hidden="true" />
    <i class="pid-panel__corner pid-panel__corner--br" aria-hidden="true" />

    <h2 v-if="title" class="pid-panel__title">
      <span class="pid-head pid-gold">{{ title }}</span>
    </h2>

    <slot />
  </section>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  /* `border-image-slice: 81 46 81 46` is in SOURCE pixels of panel-border.webp
     (112x182) — the art must never be resized (see constants/assets.ts). */
  .pid-panel {
    position: relative;
    margin: 30px 4px 16px;
    padding: 0 8px;
    border-style: solid;
    border-width: 40px 23px;
    border-image: var(--pid-img-panel-border) 81 46 81 46 fill stretch;
    border-image-width: 40px 23px;
    background: var(--pid-img-marble) center / 360px;
    background-clip: padding-box;
  }

  .pid-panel--titled {
    padding-top: 14px;
  }

  .pid-panel::before,
  .pid-panel::after {
    content: '';
    position: absolute;
    left: 50%;
    width: 56px;
    height: 26px;
    background: var(--pid-img-finial) center / contain no-repeat;
    pointer-events: none;
  }

  .pid-panel::before {
    top: -48px;
    transform: translateX(-50%);
  }

  .pid-panel::after {
    bottom: -48px;
    transform: translateX(-50%) scaleY(-1);
  }

  .pid-panel__corner {
    position: absolute;
    width: 40px;
    height: 40px;
    background: var(--pid-img-corner) center / contain no-repeat;
    pointer-events: none;
  }

  .pid-panel__corner--tl {
    top: -46px;
    left: -30px;
  }

  .pid-panel__corner--tr {
    top: -46px;
    right: -30px;
    transform: scaleX(-1);
  }

  .pid-panel__corner--bl {
    bottom: -46px;
    left: -30px;
    transform: scaleY(-1);
  }

  .pid-panel__corner--br {
    right: -30px;
    bottom: -46px;
    transform: scale(-1);
  }

  .pid-panel__title {
    position: absolute;
    top: -64px;
    left: 50%;
    z-index: 2;
    display: grid;
    place-items: center;
    width: min(250px, 78%);
    height: 46px;
    margin: 0;
    padding: 6px 26px 0;
    background: var(--pid-img-plaque) center / 100% 100%;
    transform: translateX(-50%);
  }

  .pid-panel__title > span {
    font-size: 13px;
    white-space: nowrap;
  }
}
</style>
