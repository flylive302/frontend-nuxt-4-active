<script setup lang="ts">
import { ref } from "vue"

definePageMeta({ layout: 'alt' })

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

const items = ref([
  {
    title: 'Level 1',
    description: 'Pro Badge',
    icon: 'i-lucide-trophy'
  },
  {
    title: 'Level 2',
    description: 'Custom Room Card',
    icon: 'i-lucide-trophy'
  },
  {
    title: 'Level 3',
    description: 'Agency Frame',
    icon: 'i-lucide-trophy'
  },
  {
    title: 'Level 4',
    description: 'Custom Entry',
    icon: 'i-lucide-trophy'
  },
  {
    title: 'Maxed Out',
    description: 'Top Agency'
  }
])
</script>

<template>
  <main>
    <NavAlt back-to="/agency/owner">Agency Income</NavAlt>
    <div class="px-3 my-12">

      <SectionTitle>Agency Owners Earnings</SectionTitle>

      <div class="flex justify-between mt-2 items-center">
        <UButton variant="subtle" color="primary" size="sm" icon="i-lucide-calendar-clock">May 2024</UButton>
        <UButton variant="subtle" color="primary" size="sm" square icon="i-lucide-info" />
      </div>
      <div class="flex items-center border border-primary rounded-lg p-2 bg-primary/20 mt-2">
        <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="transform w-14" />
        <h2 class="text-6xl font-bold leading-none text-center w-full">75K</h2>
      </div>

      <SectionTitle class="mt-4">Total Coins Earned</SectionTitle>

      <div class="grid grid-cols-6 mt-3 mb-5 gap-2 items-center">

        <div class="col-span-5 flex items-center border border-primary rounded-lg p-2 bg-primary/20">
          <NuxtImg provider="imagekit" src="/siteAssets/props/flylive_coin.webp" class="transform w-14" />
          <h2 class="text-6xl font-bold leading-none text-center w-full">250K</h2>
        </div>

        <div class="col-span-1">
          <UButton
              color="primary"
              size="xl"
              square
              icon="i-lucide-trophy"
              class="rounded-full mx-auto"
          />
          <p class="text-sm text-center font-semibold">Level 1</p>
        </div>

      </div>

      <div class="w-full overflow-x-scroll pb-2">
        <UStepper :ui="{indicator: 'text-white'}" :items="items" class="w-[250%]" />
      </div>

      <p class="text-base mt-4 mb-6 font-bold bg-elevated rounded-md border-2 border-primary px-2 py-1 leading-tight text-shadow-md">
        The Agency Have Earned <span class="text-primary">250K Coins</span> You Need <span class="text-primary">400K Coins</span> More to reach the next <span class="text-primary">Level 2</span>
      </p>
      <SectionTitle type="primary">History of Earned Coins</SectionTitle>

      <UTable :data="data" class="mt-3 shadow-lg shadow-neutral-900 border rounded-lg" />
    </div>
  </main>
</template>