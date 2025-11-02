<script setup lang="ts">
import {z} from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

const schema = z.object({
  diamonds: z.coerce.number('Invalid diamonds').int('Must be a whole number').nonnegative('Must be non-negative'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  diamonds: undefined,
})

const toast = useToast()
async function onSubmit(event: FormSubmitEvent<Schema>) {
  toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
  console.log(event.data)
}
</script>

<template>
  <div>
    <NavAlt color="secondary" current="Diamonds" back-to="/profile" links-to="/wallet/purchase-coins" links="Coins"/>
    <AltHero class="z-10" image-src="/siteAssets/alt-hero/secondary.webp">
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
    <div class="h-10" />

    <section class="px-3">
      <h2 class="text-lg font-bold leading-tight">Exchange Your Diamonds with <span class="text-tertiary">FlyLive Coins</span></h2>
      <p class="text-sm text-success">Exchange Rate: 1 Diamond = 3 Coins</p>

      <UForm :schema="schema" :state="state" class="space-y-2 mt-3" @submit="onSubmit">

        <UFormField label="Enter Number of Diamonds" name="diamonds" class="w-full" required>
          <UInputNumber v-model="state.diamonds" placeholder="50" color="secondary" class="w-full" />
        </UFormField>

        <p class="font-semibold text-base leading-none">Change in Balances after Exchange:</p>
        <div class="flex items-center gap-2 bg-gradient-to-br to-primary/30 px-2 py-1 border border-primary rounded-md">

          <div class="flex items-center gap-1 w-full">
            <NuxtImg provider="imagekit" src="/siteAssets/props/flylive-diamond.webp" class="w-8" />
            <p class="text-base font-semibold leading-none">Diamonds: <br> <span class="text-secondary-400 font-bold text-base">9949</span></p>
          </div>

          <USeparator color="primary" orientation="vertical" class="h-8" />

          <div class="flex items-center gap-1 w-full">
            <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="w-8" />
            <p class="text-base  font-semibold leading-none">Coins: <br> <span class="text-tertiary font-bold text-base">1049</span></p>
          </div>

        </div>

        <UButton size="lg" class="w-full justify-center mt-2" icon="i-lucide-send" color="secondary" type="submit">
          Submit
        </UButton>
      </UForm>

      <USeparator color="secondary" class="my-4" label="OR" />

      <h2 class="text-lg font-bold leading-tight">Request Payout of your Diamonds in <span class="text-success">Real Money</span>.</h2>
      <ChooseDefaultReseller color="secondary" />
      <FromConversionRequest color="secondary" class="mb-18 mt-4" />
    </section>
  </div>
</template>

<style scoped>

</style>