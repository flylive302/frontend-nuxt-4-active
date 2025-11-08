<script setup lang="ts">

</script>

<template>
  <div class="grid grid-cols-12 bg-gradient-to-br to-primary/40 border-2 border-primary rounded-md pr-1">
    <div class="col-span-3 flex flex-col justify-center">
      <Avatar :animated="true" />
    </div>
    <div class="col-span-9 flex flex-col justify-center">
      <div class="flex items-center justify-between gap-1">
        <h3 class="text-sm font-bold">User Name</h3>
        <ProfileBadge />
      </div>
      <div class="flex justify-between items-center mt-1">
        <div class="flex gap-1">
          <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
          <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="1"/>
          <p class="text-sm font-bold leading-none flex items-center">
            <icon name="i-lucide-mars" />
            Male
          </p>
          <UButton icon="i-lucide-eye" variant="subtle" size="xs">Visit</UButton>
        </div>
      </div>
    </div>
  </div>
</template>