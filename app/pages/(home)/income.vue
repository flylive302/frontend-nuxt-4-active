<script setup lang="ts">
import {z} from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { reactive, ref } from "vue"

definePageMeta({
  layout: 'alt',
  middleware: 'auth'
})

const schema = z.object({
  coins: z.coerce.number('Invalid coins').int('Must be a whole number').nonnegative('Must be non-negative'),
})

type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({
  coins: undefined,
})

const toast = useToast()
async function onSubmit(_event: FormSubmitEvent<Schema>) {
  toast.add({ title: 'Success', description: 'The form has been submitted.', color: 'success' })
}

const data = ref([
  {
    date: '2024-03-11T',
    coins: 1950,
  },
  {
    date: '2024-03-11T',
    coins: 1950,
  },
  {
    date: '2024-03-11T',
    coins: 1950,
  },
  {
    date: '2024-03-11T',
    coins: 1950,
  },
  {
    date: '2024-03-11T',
    coins: 1950,
  },
  {
    date: '2024-03-11T',
    coins: 1950,
  },
])
</script>

<template>
  <main>
    <NavAlt color="tertiary" back-to="/profile">My Income</NavAlt>
    <div class="px-3 my-12">

      <SectionTitle type="tertiary">Total Coins Available</SectionTitle>
      <div class="flex items-center border border-tertiary rounded-lg p-2 bg-tertiary/20 mt-2">
        <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="transform w-14" />
        <h2 class="text-6xl font-bold leading-none text-center w-full">75000K</h2>
      </div>
      <h2 class="text-lg font-bold">Convert Your Coins into Diamonds to later Withdraw as <span class="text-success">Cash.</span></h2>
      <p class="text-success text-sm font-semibold">Exchange Rate: 1 Diamond = 1750 Coins</p>

      <UForm :schema="schema" :state="state" class="space-y-2 my-3" @submit="onSubmit">

        <UFormField label="Enter Number of Coins" name="coins" class="w-full" required>
          <UInputNumber v-model="state.coins" placeholder="50" :color="('tertiary' as any)" class="w-full" />
        </UFormField>

        <p class="font-semibold text-base leading-none">Change in Balances after Exchange:</p>
        <div class="flex items-center gap-2 bg-gradient-to-br to-primary/30 px-2 py-1 border border-primary rounded-md">

          <div class="flex items-center gap-1 w-full">
            <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="w-8" />
            <p class="text-base  font-semibold leading-none">Coins: <br> <span class="text-tertiary font-bold text-base">1049</span></p>
          </div>

          <USeparator color="primary" orientation="vertical" class="h-8" />

          <div class="flex items-center gap-1 w-full">
            <NuxtImg provider="imagekit" src="/siteAssets/props/flylive-diamond.webp" class="w-8" />
            <p class="text-base font-semibold leading-none">Diamonds: <br> <span class="text-secondary-400 font-bold text-base">9949</span></p>
          </div>

        </div>

        <UButton size="lg" class="w-full justify-center mt-2" icon="i-lucide-send" :color="('tertiary' as any)" type="submit">
          Convert
        </UButton>
      </UForm>

      <USeparator color="neutral" class="my-4" />

      <SectionTitle type="tertiary">Total Coins Earned</SectionTitle>
      <div class="flex justify-between mt-2 items-center">
        <UButton variant="subtle" :color="('tertiary' as any)" size="sm" icon="i-lucide-calendar-clock">May 2024</UButton>
        <UButton variant="subtle" :color="('tertiary' as any)" size="sm" square icon="i-lucide-info" />
      </div>

      <div class="grid grid-cols-6 mt-3 mb-5 gap-2">

        <div class="col-span-5 flex items-center border border-tertiary rounded-lg p-2 bg-tertiary/20">
          <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="transform w-14" />
          <h2 class="text-6xl font-bold leading-none text-center w-full">2500</h2>
        </div>

        <div class="col-span-1">
          <UButton
              :color="('tertiary' as any)"
              size="xl"
              square
              icon="i-lucide-sparkles"
              class="rounded-full mx-auto"
          />
          <p class="text-sm text-center font-semibold">Target 1</p>
        </div>

      </div>


      <SectionTitle type="tertiary">History of Earned Coins</SectionTitle>

      <UTable :data="data" class="mt-3 shadow-lg shadow-neutral-900 border rounded-lg" />
    </div>
  </main>
</template>