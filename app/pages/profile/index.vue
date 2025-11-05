<script setup lang="ts">
definePageMeta({ layout: 'alt' })
</script>

<template>
  <main>
    <NavAlt sub-menu-to="/">My Profile</NavAlt>

    <AltHero class="z-20">
      <div class="flex flex-col justify-center min-h-[55vw] bg-gradient-to-br to-primary/30">
        <NuxtLink to="/profile/owner-@NewUser" class="flex px-3">
          <Avatar :animated="true" class="w-24" />
          <div class="px-3">
            <h1 class="text-lg font-bold underline">User Name</h1>
            <ProfileBadge />
            <div class="flex gap-2">
              <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
              <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="1"/>
            </div>
          </div>
        </NuxtLink>
      </div>
    </AltHero>

    <UserStats class="mt-1"/>

    <SectionTitle class="mt-6 mb-2 mx-3">Cp RelationShips</SectionTitle>

    <EventsProfileCard />

    <div class="p-3 mb-12">
      <NavProfileItem to="/wallet/purchase-coins" icon="i-lucide-wallet" txt="Wallet" />
      <NavProfileItem to="/mall/" icon="i-lucide-store" txt="Mall" />
      <NavProfileItem to="/levels/wealth" icon="i-lucide-crown" txt="Levels" />
      <NavProfileItem to="/income" icon="i-lucide-dollar-sign" txt="My Income" />
    </div>
  </main>
</template>