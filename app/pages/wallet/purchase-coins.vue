<template>
  <div>
    <NavAlt color="tertiary" current="Coins" back-to="/profile" links-to="/wallet/exchange-diamonds" links="Diamonds"/>
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
    <div class="h-14" />
    <section class="px-3">
      <h2 class="text-lg font-bold"><span class="text-success">Buy</span> Coins From the Resellers</h2>
      <p class="text-sm !text-muted">Keep your default reseller or select a Different One</p>
      <ChooseDefaultReseller color="tertiary" />

      <FromConversionRequest class="mt-4" />
      <USeparator color="tertiary" class="my-4" label="OR" />
      <h2 class="text-lg font-bold mb-2">Purchase Coins By Card:</h2>
      <div class="flex flex-col gap-3">
        <ListItemPurchaseCoins />
        <ListItemPurchaseCoins :coins="3200" :price="1.55" />
        <ListItemPurchaseCoins :coins="6400" :price="3.25" />
      </div>
    </section>
    <div class="h-14" />
  </div>
</template>