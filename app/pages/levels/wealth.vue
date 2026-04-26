<script setup lang="ts">
// ========================================
// Wealth Level Page
// ========================================
// Route binding only — delegates all UI to LevelPage component.

definePageMeta({ layout: 'alt', middleware: 'auth' })
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile" :linked="true" first-link="/levels/wealth/" second-link="/levels/charm/">
      <template #first-link-text>Wealth Level</template>
      <template #second-link-text>Charm Level</template>
    </NavAlt>

    <LevelsLevelPage
      color="tertiary"
      category="wealth"
      hero-image="https://ik.imagekit.io/flylive/siteAssets/alt-hero/tertiary.webp"
      default-badge-url="https://ik.imagekit.io/flylive/badges/wealth/level_1.webp"
      description="1 Coin spent is equal to 1 Experience Point. As your level increases, you'll unlock new badges."
    />
  </main>
</template>
