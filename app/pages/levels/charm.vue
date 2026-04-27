<script setup lang="ts">
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
      hero-image="https://ik.imagekit.io/flylive/siteAssets/alt-hero/charm.jpeg"
      default-badge-url="https://ik.imagekit.io/flylive/badges/charm/level_1.webp"
      description="Charm XP is earned when you receive gifts. As your level increases, you'll unlock new badges."
    />
  </main>
</template>
