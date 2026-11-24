<script setup lang="ts">
/**
 * Choose ID / Rare Auction — two plaque links under the hero. Real
 * routes, so the active tab comes from the router and the phone's back button
 * walks the tabs like any other navigation.
 */
import { PRETTY_ID_TABS } from '~/constants/pretty-id'
</script>

<template>
  <nav aria-label="Pretty ID tabs" class="pid-tabs">
    <NuxtLink
      v-for="tab in PRETTY_ID_TABS"
      v-slot="{ isExactActive, href, navigate }"
      :key="tab.to"
      :to="tab.to"
      custom
    >
      <a
        :href="href"
        class="pid-tab"
        :class="{ 'pid-tab--on': isExactActive }"
        :aria-current="isExactActive ? 'page' : undefined"
        @click="navigate"
      >
        <span class="pid-head">{{ tab.label }}</span>
      </a>
    </NuxtLink>
  </nav>
</template>

<style scoped>
/* `components` layer: below Tailwind utilities, so a utility on the element wins (see pretty-id.css). */
@layer components {
  .pid-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    padding: 8px 10px 4px;
  }

  .pid-tab {
    display: grid;
    place-items: center;
    min-width: 0;
    height: 50px;
    padding: 0 14px;
    background: var(--pid-img-plaque-dim) center / 100% 100%;
    white-space: nowrap;
  }

  .pid-tab > span {
    color: var(--pid-tab-idle);
    font-size: clamp(9px, 2.9vw, 13px);
    line-height: 1;
  }

  .pid-tab--on {
    background-image: var(--pid-img-plaque);
    filter: drop-shadow(0 0 10px #f6d07888);
  }

  .pid-tab--on > span {
    background: var(--pid-gold-gradient);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .pid-tab:focus-visible {
    outline: 2px solid var(--pid-gold);
    outline-offset: 2px;
  }
}
</style>
