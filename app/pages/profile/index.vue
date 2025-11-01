<script setup lang="ts">
const items = [
  {
    label: 'Gifts',
    icon: 'i-lucide-gift',
    slot: 'gifts'
  },
  {
    label: 'Entries',
    icon: 'i-lucide-door-open',
    slot: 'entries'
  },
  {
    label: 'Frames',
    icon: 'i-lucide-frame',
    slot: 'frames'
  }
]
</script>

<template>
  <main>
    <NavAlt current="My Profile" sub-menu-to="/" />

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

    <SectionTitle class="my-2 mx-3">Agency</SectionTitle>
    <div class="mx-3 grid grid-cols-12 bg-gradient-to-br to-primary/30 rounded-md border border-primary">
      <div class="col-span-3">
        <Avatar :animated="true" />
      </div>

      <div class="col-span-6 flex flex-col justify-around">
        <p class="text-sm !text-muted font-semibold truncate">Agency Annotations</p>
        <p class="text-md font-bold truncate">Agency Name</p>
      </div>

      <div class="col-span-3 flex flex-col justify-between py-2">

        <div class="flex gap-1 items-center">
          <UBadge icon="i-lucide-sparkles" :square="true" class="rounded-full p-1" />
          <p class="text-xs font-bold leading-none">1 <br> Level</p>
        </div>

        <div class="flex gap-1 items-center">
          <UBadge icon="i-lucide-users" :square="true" class="rounded-full" />
          <p class="text-xs font-bold leading-none truncate">42 <br> Members</p>
        </div>
      </div>
    </div>

    <SectionTitle class="my-2 mx-3">Cp RelationShips</SectionTitle>

    <EventsProfileCard />

    <div class="p-3 mb-12">
      <NavProfileItem to="/wallet/purchase-coins" icon="i-lucide-wallet" txt="Wallet" />
      <NavProfileItem to="/" icon="i-lucide-crown" txt="Levels" />
      <NavProfileItem to="/" icon="i-lucide-crown" txt="Levels" />
      <NavProfileItem to="/" icon="i-lucide-crown" txt="Levels" />

      <SectionTitle class="mt-4">History</SectionTitle>

      <UTabs class="w-full" variant="link" :items="items">
        <template #gifts>
          <div class="grid grid-cols-3 gap-2">
            <ProfileHistoryCard />
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-wealth-level-3.webp" item-name="wealth Badge" />
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
          </div>
        </template>

        <template #entries>
          <div class="grid grid-cols-3 gap-2">
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-wealth-level-3.webp" item-name="wealth Badge" />
            <ProfileHistoryCard />
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
          </div>
        </template>

        <template #frames>
          <div class="grid grid-cols-3 gap-2">
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
            <ProfileHistoryCard />
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-wealth-level-3.webp" item-name="wealth Badge" />
            <ProfileHistoryCard badge-src="/siteAssets/badges/badge-charm-level-1.webp" item-name="Charm Badge"/>
          </div>
        </template>
      </UTabs>
    </div>

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