<script setup lang="ts">
definePageMeta({ layout: 'alt' })
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
    <NavAlt sub-menu-to="/">Public Profile</NavAlt>
    <AltHero class="z-20">
      <div class="flex flex-col justify-center min-h-[55vw] bg-gradient-to-br to-primary/30">
        <div class="flex px-3">
          <UserAvatar :animated="true" class="w-24" />
          <div class="px-3">
            <h1 class="text-lg font-bold">User Name</h1>
            <ProfileBadge />
            <div class="flex gap-2">
              <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
              <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="1"/>
            </div>
          </div>
        </div>
      </div>
    </AltHero>

    <UserStats class="mt-1"/>

    <SectionTitle class="mt-6 mb-2 mx-3">Cp RelationShips</SectionTitle>

    <EventsProfileCard />

    <SectionTitle class="mt-4 mb-2 mx-3">Agency</SectionTitle>
    <NuxtLink to="/agency/id" class="mx-3 grid grid-cols-12 bg-gradient-to-br to-primary/30 rounded-md border border-primary">
      <div class="col-span-3">
        <UserAvatar :animated="true" />
      </div>

      <div class="col-span-6 flex flex-col justify-around">
        <p class="text-sm !text-muted font-semibold truncate">Agency Annotations</p>
        <p class="text-md font-bold truncate">Agency Name</p>
      </div>

      <div class="col-span-3 flex flex-col justify-between py-2">

        <div class="flex gap-1 items-center">
          <UBadge icon="i-lucide-sparkles" square class="rounded-full text-white" />
          <p class="text-xs font-bold leading-none">1 <br> Level</p>
        </div>

        <div class="flex gap-1 items-center">
          <UBadge icon="i-lucide-users" square class="rounded-full text-white" />
          <p class="text-xs font-bold leading-none truncate">42 <br> Members</p>
        </div>
      </div>
    </NuxtLink>

    <div class="p-3 mb-12">
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

    <footer
        aria-label="Primary"
        class="fixed inset-x-2 z-50 bottom-4"
    >
      <BgGlass
          class="border border-white/40"
          frost-blur-radius="blur(4px)"
          :noise-frequency="0.009"
          :noise-strength="200"
          rounded="rounded-lg"
      >
        <div class="flex justify-between items-center px-1 py-1 gap-2 touch-manipulation select-none">
          <UButton to="/" icon="i-lucide-locate-fixed" size="sm" class="pl-1 pr-2 gap-1">
            Track
          </UButton>
          <UButton to="/" icon="i-lucide-star" size="sm" class="pl-1 pr-2 gap-1">
            Follow
          </UButton>
          <UButton to="/" icon="i-lucide-star" size="sm" class="pl-1 pr-2 gap-1">
            Room
          </UButton>
          <UButton to="/" icon="i-lucide-message-circle-more" size="sm" class="pl-1 pr-2 gap-1">
            Chat
          </UButton>
        </div>
      </BgGlass>
    </footer>

  </main>
</template>