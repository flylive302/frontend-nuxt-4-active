<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Wealth Level Page
// ========================================
// Route binding only — delegates all UI to LevelPage component.

definePageMeta({ layout: 'alt', middleware: 'auth' })
</script>

<template>
  <main>
    <NavAlt color="info" back-to="/profile" :linked="true" first-link="/levels/wealth/" second-link="/levels/charm/">
      <template #first-link-text><p class="text-white">Wealth Level</p></template>
      <template #second-link-text><p class="text-white">Charm Level</p></template>
    </NavAlt>

    <LevelsLevelPage
      color="info"
      category="wealth"
      :hero-image="ASSETS.HERO_WEALTH"
      :default-badge-url="ASSETS.DEFAULT_WEALTH_LEVEL_BADGE"
      description="1 Coin spent is equal to 1 Experience Point. As your level increases, you'll unlock new badges."
    />
  </main>
</template>
