<script setup lang="ts">

</script>

<template>
  <main>
    <NavAlt color="primary" links-to="/" links="Some Page" sub-menu-to="/" />
    <div class="h-12"/>
    <div class="px-3">
      <h1 class="text-lg font-bold">Welcome to Profile</h1>

      <ProfileBadge />
      <div class="flex gap-2">
        <ProfileBadge badge-src="/badges/badge-charm-level-4.webp" color="tertiary" txt="1"/>
        <ProfileBadge badge-src="/badges/badge-wealth-level-3.webp" color="secondary" txt="1"/>
      </div>
    </div>

    <footer class="fixed inset-x-3 z-50 bottom-4">
      <BgGlass
          frost-blur-radius="blur(4px)"
          :noise-frequency="0.009"
          :noise-strength="200"
          rounded="rounded-md"
          class="px-4 py-1 border border-white/40"
      >
        <UButton class="w-full justify-center">Button</UButton>
      </BgGlass>
    </footer>
  </main>
</template>

<style scoped>

</style>