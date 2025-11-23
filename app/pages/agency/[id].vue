<script setup lang="ts">
import { ref } from "vue";
import { useRoute } from "vue-router";

definePageMeta({ layout: 'alt' })

const route = useRoute();

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
    <NavAlt back-to="/profile">Agency</NavAlt>

    <AltHero class="z-20">
      <div class="flex flex-col justify-center min-h-[55vw] bg-gradient-to-br to-primary/30">
        <NuxtLink :to="`/agency/${route.params.id}`" class="grid grid-cols-5 gap-2">
          <UserAvatar :animated="true" class="col-span-2" />
          <div class="col-span-3 pr-3 my-auto">
            <h1 class="text-lg font-bold underline">Agency {{route.params.id}}</h1>
            <div class="flex justify-between w-full">
              <p class="text-base font-semibold">Country</p>
              <icon name="i-flag-ad-4x3" class="size-8 rounded overflow-hidden h-6 shadow-md shadow-primary/50" />
            </div>
            <div class="flex justify-between w-full">
              <p class="text-base font-semibold">Members</p>
              <p class="text-lg font-bold flex items-center gap-2"><icon class="size-6" name="i-lucide-users"/> 89</p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </AltHero>
    <div class="relative w-full mt-2 z-30 grid grid-cols-3 text-sm text-center font-bold leading-none">
      <p><icon name="i-lucide-coins" /> 159K<br> Total Coins </p>
      <p><icon name="i-lucide-sparkles" /> 1<br> Level </p>
      <p><icon name="i-lucide-users" /> 48<br> Members </p>
    </div>
    <div class="px-3 mt-4 mb-24">
      <SectionTitle class="mb-3">Agency Levels and their Rewards</SectionTitle>
      <div class="w-full overflow-x-scroll pb-2">
        <UStepper :ui="{indicator: 'text-white'}" :items="items" class="w-[250%] bg-transparent" />
      </div>

      <SectionTitle class="my-3">Agency Levels and their Rewards</SectionTitle>
      <div class="flex flex-col gap-3">
        <AgencyMemberCard
            name="Ali Butt"
        />
        <AgencyMemberCard />
        <AgencyMemberCard />
        <AgencyMemberCard />
        <AgencyMemberCard />
      </div>
    </div>
  </main>
</template>