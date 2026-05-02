<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
// ========================================
// Charm Level Page
// ========================================
// Route binding only — delegates all UI to LevelPage component.

definePageMeta({ layout: 'alt', middleware: 'auth' })
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/levels/wealth/" second-link="/levels/charm/">
      <template #first-link-text>Wealth Level</template>
      <template #second-link-text>Charm Level</template>
    </NavAlt>

    <LevelsLevelPage
      color="secondary"
      category="charm"
      :hero-image="ASSETS.HERO_CHARM"
      :default-badge-url="ASSETS.DEFAULT_CHARM_LEVEL_BADGE"
      description="Charm XP is earned when you receive gifts. As your level increases, you'll unlock new badges."
    />
  </main>
</template>
