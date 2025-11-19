<script setup lang="ts">
import type { StepperItem } from "@nuxt/ui";
import {ref} from "vue";

const emit = defineEmits(['update:roomOpen'])

const minimizeRoom = () => emit('update:roomOpen', false)


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

const adminAnnouncements = ref<StepperItem[]>([
  {
    title: '24-04-2014',
    description: 'Admin Announcements will be displayed here in a proper formate with date and time',
    icon: 'i-lucide-asterisk'
  },
  {
    title: '24-04-2014',
    description: 'Admin Announcements will be displayed here in a proper formate with date and time',
    icon: 'i-lucide-asterisk'
  },
  {
    title: '24-04-2014',
    description: 'Admin Announcements will be displayed here in a proper formate with date and time',
    icon: 'i-lucide-asterisk'
  },
  {
    title: '24-04-2014',
    description: 'Admin Announcements will be displayed here in a proper formate with date and time',
    icon: 'i-lucide-asterisk'
  },
  {
    title: '24-04-2014',
    description: 'Admin Announcements will be displayed here in a proper formate with date and time',
    icon: 'i-lucide-asterisk'
  },
])
</script>

<template>

  <header class="flex justify-between items-center">

    <!-- Left Section -->
    <div class="rounded-md flex items-center border border-primary-800 bg-gradient-to-br to-primary/60 gap-1 backdrop-blur-xs">
      <UDrawer>
        <div class="w-10">
          <Avatar :animated="true" />
          <p class="text-xs text-center">LvL. 15</p>
        </div>

        <template #content>
          <div class="px-3">
            <SectionTitle class="mb-3">Room Details</SectionTitle>
            <div class="px-2 pt-3 bg-neutral-800 rounded-t-lg inset-shadow-sm inset-shadow-neutral-800 gap-4">
              <div class="flex gap-1 w-full">
                <Avatar :animated="true" class="w-20"/>
                <div class="w-full">
                  <div class="flex justify-between items-baseline">
                    <h2 class="text-base font-bold">Room Name</h2>
                    <UButton icon="i-lucide-trophy" class="px-2 py-1 font-bold" size="sm">1</UButton>
                  </div>
                  <div class="flex justify-between items-baseline">
                    <h2 class="text-base font-bold">Recalled: 750</h2>
                    <ProfileBadge :show-badge="false" />
                  </div>
                </div>
              </div>

              <SectionTitle class="mt-1">Levels</SectionTitle>
              <p class="text-base font-semibold">
                Current Room Level is 1 need 51654 XP (Experience Points ) to reach Level 2
              </p>

              <div class="w-full overflow-x-scroll pb-2">
                <UStepper :ui="{indicator: 'text-white'}" :items="items" size="sm" class="w-[250%]" />
              </div>

              <SectionTitle class="mt-1">Admin Announcements</SectionTitle>
              <UStepper
                  :ui="{indicator: 'text-white'}"
                  :items="adminAnnouncements"
                  size="sm"
                  class="bg-default p-2 rounded-md mt-2 overflow-scroll shadow-lg shadow-neutral-950 max-h-[30vh]"
                  orientation="vertical"
              />
            </div>
          </div>
        </template>
      </UDrawer>

      <div>
        <div class="flex items-center justify-between gap-2 pr-1">
          <div>
            <p class="text-xs leading-tight">UserSignature</p>
            <h1 class="text-sm font-bold leading-tight">Room Name</h1>
          </div>
          <UButton icon="i-lucide-bookmark" variant="subtle" class="shadow-md shadow-primary-950/50" size="sm" />
        </div>

        <div class="flex items-center gap-1 mt-1">
          <NuxtImg
              v-for="i in 4"
              :key="i"
              provider="imagekit"
              src="/siteAssets/badges/badge-wealth-level-3.webp"
              class="size-4"
          />
        </div>
      </div>
    </div>

    <!-- Right Section -->
    <div class="flex items-center ml-auto gap-2">
      <UButton
          icon="i-lucide-share-2"
          size="xl"
          class="rounded-full border border-primary-600 cursor-pointer shadow-lg shadow-primary-950/50 backdrop-blur-xs"
          variant="subtle"
      />

      <UDrawer>
        <UButton
            icon="i-lucide-x"
            size="xl"
            class="rounded-full border border-primary-600 cursor-pointer shadow-lg shadow-primary-950/50 backdrop-blur-xs"
            variant="subtle"
        />

        <template #content>
          <div class="px-3 mt-2">
            <div class="p-4 bg-neutral-800 rounded-t-lg inset-shadow-sm inset-shadow-neutral-800 flex items-center justify-between gap-4">
              <UButton
                  icon="i-lucide-minimize" color="secondary" size="xl" variant="subtle"
                  class="w-full justify-center"
                  @click="minimizeRoom()"
              >
                Minimize
              </UButton>

              <UButton
                  icon="i-lucide-door-open"
                  class="w-full justify-center"
                  size="xl" variant="subtle"
              >
                Leave
              </UButton>
            </div>
          </div>
        </template>
      </UDrawer>

    </div>
  </header>

</template>