<template>
  <div>
    <NavAlt color="tertiary" current="Coins" back-to="/profile" links-to="/profile" links="Diamonds"/>
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
    <div class="h-10" />
    <div class="px-3">
      <h2 class="text-lg font-bold"><span class="text-success">Buy</span> Coins From the Resellers</h2>
      <p class="text-sm !text-muted">Keep your default reseller or select a Different One</p>
      <ChoseDefaultReseller color="tertiary" />

      <FromConversionRequest class="mt-4" />
    </div>
    <div class="h-14" />
  </div>
</template>