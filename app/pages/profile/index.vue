<template>
  <main>
    <NavAlt color="primary" links-to="/" links="Some Page" sub-menu-to="/" />
    <AltHero class="z-20">
      <div class="px-3 py-9 flex bg-gradient-to-br to-primary/30">
        <Avatar :animated="true" class="w-24" />
        <div class="px-3">
          <h1 class="text-lg font-bold">User Name</h1>
          <ProfileBadge />
          <div class="flex gap-2">
            <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
            <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="1"/>
          </div>
        </div>
      </div>
    </AltHero>

    <UserStats class="mt-1"/>

    <SectionTitle class="my-2 mx-3">Cp RelationShips</SectionTitle>

    <EventsProfileCard />

    <div class="p-3 mb-12">
      <NavProfileItem to="/" icon="i-lucide-wallet" txt="Wallet" />
      <NavProfileItem to="/" icon="i-lucide-crown" txt="Levels" />
      <NavProfileItem to="/" icon="i-lucide-crown" txt="Levels" />
      <NavProfileItem to="/" icon="i-lucide-crown" txt="Levels" />

      <div class="grid mt-4 grid-cols-3 gap-2">
        <ProfileHistoryCard />
        <ProfileHistoryCard badge-src="/siteAssets/badges/badge-wealth-level-3.webp" item-name="wealth Badge" />
        <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
      </div>
    </div>

    <AltHero image-src="/siteAssets/alt-hero/tertiary.webp">
      <div class="flex p-2 bg-gradient-to-br to-tertiary/30">
        <div class="flex flex-col justify-end">
          <NuxtImg provider="imagekit" src="/siteAssets/props/prop-recharge.webp" class="transform -scale-x-100 w-20" />
        </div>
        <div class="flex-auto flex flex-col justify-between items-center">
          <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="w-full mb-2" />
          <UButton color="tertiary" icon="i-lucide-coins" trailing-icon="i-lucide-history">9999</UButton>
        </div>
        <div class="flex flex-col justify-end">
          <NuxtImg provider="imagekit" src="/siteAssets/props/prop-recharge.webp" class="w-20" />
        </div>
      </div>
    </AltHero>

    <AltHero class="z-10 mt-12" image-src="/siteAssets/alt-hero/secondary.webp">
      <div class="flex p-2 bg-gradient-to-br to-secondary/30">
        <div class="flex flex-col justify-end items-center">
          <NuxtImg provider="imagekit" src="/siteAssets/props/prop-diamond.svg" format="webp" class="w-14" />
        </div>
        <div class="flex-auto flex flex-col justify-between items-center">
          <NuxtImg provider="imagekit" src="/siteAssets/props/flylive-diamond.webp" class="w-full mb-2 max-w-28" />
          <UButton color="secondary" icon="i-lucide-coins" trailing-icon="i-lucide-history">9999</UButton>
        </div>
        <div class="flex flex-col justify-end">
          <NuxtImg provider="imagekit" src="/siteAssets/props/prop-diamond.svg" format="webp" class="transform -scale-x-100 w-14" />
        </div>
      </div>
    </AltHero>

    <div class="h-64"/>
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
<script setup lang="ts">
</script>