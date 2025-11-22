<script setup lang="ts">
// Gifting Drawer : gifting-drawer.vue -> component

import { ref } from "vue";
import type { TabsItem } from '@nuxt/ui'

const types = ref<TabsItem[]>([
  {
    label: 'Normal',
    location: 'normal',
  },
  {
    label: 'Lucky',
    location: 'lucky',
  },
  {
    label: 'Cp Gift',
    location: 'cp-gift',
  },
  {
    label: 'Vip Gift',
    location: 'vip-gift',
  },
  {
    label: 'Country',
    location: 'country',
  },
  {
    label: 'Celebrity',
    location: 'celebrity',
  },
  {
    label: 'Bag',
    location: 'bag',
  }
])

</script>

<template>
  <UDrawer>
    <NuxtImg src="/room/gift-box.png" alt="room prop" class="w-12" />
    <template #content>
      <div class="px-2 my-2">

        <div class="flex justify-between items-center">

          <div class="flex gap-1">
            <div>
              <UButton size="xs" square class="rounded-full">All</UButton>
            </div>

            <div class="flex items-center w-48 overflow-x-scroll scrollbar">
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
              <UUser :avatar="{ src: 'https://i.pravatar.cc/150?u=john-doe', class: 'border p-0 m-0' }" chip size="sm" />
            </div>
          </div>

          <UButton size="xs">Info</UButton>

        </div>

        <UTabs
            color="primary"
            variant="link"
            size="xs"
            :items="types"
            class="w-full"
            :ui="{
              list: 'max-w-full !overflow-x-scroll !overflow-y-none',
              indicator: 'bottom-1',
              trigger: 'min-w-fit',
              content: 'grid grid-cols-4 gap-1 bg-accented inset-shadow-sm inset-shadow-neutral-950 rounded-md p-2 max-h-[30vh] overflow-y-scroll'
            }"
        >
          <template #content="{ item }">
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
            <RoomGiftCard :category="item.location" />
          </template>
        </UTabs>

        <RoomPlayGift />

      </div>
    </template>
  </UDrawer>
</template>