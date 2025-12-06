<script setup lang="ts">
import {h, ref, resolveComponent} from "vue";
import type {ColumnDef} from "@tanstack/vue-table";

const roomStore = useRoomStore();
interface WealthLevelRow {
  level: string;
  badge: {
    badgeSrc: string;
    color: string;
    txt: string;
    class?: string;
  };
}

const profileBadge = resolveComponent('ProfileBadge')

const columns: ColumnDef<WealthLevelRow>[] = [
  {
    accessorKey: 'level',
    header: 'Level',
  },
  {
    accessorKey: 'badge',
    header: 'Badge',
    cell: ({ getValue }) => {
      const badge = getValue() as WealthLevelRow['badge'] | undefined

      if (!badge) {
        return null
      }

      return h(profileBadge, {
        class: badge.class,
        badgeSrc: badge.badgeSrc,
        color: badge.color,
        txt: badge.txt,
      })
    },
  },
]

const data = ref<WealthLevelRow[]>([
  {
    level: 'Level 1',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-1.webp',
      color: 'secondary',
      txt: '1',
      class: '',
    },
  },
  {
    level: 'Level 2',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-2.webp',
      color: 'secondary',
      txt: '2',
      class: '',
    },
  },
  {
    level: 'Level 3',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-3.webp',
      color: 'secondary',
      txt: '3',
      class: '',
    },
  },
  {
    level: 'Level 4',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-3.webp',
      color: 'secondary',
      txt: '4',
      class: '',
    },
  },
  {
    level: 'Level 5',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-3.webp',
      color: 'secondary',
      txt: '5',
      class: '',
    },
  },
  {
    level: 'Level 6',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-2.webp',
      color: 'secondary',
      txt: '6',
      class: '',
    },
  },
  {
    level: 'Level 7',
    badge: {
      badgeSrc: '/siteAssets/badges/badge-charm-level-1.webp',
      color: 'secondary',
      txt: '7',
      class: '',
    },
  },
])
</script>

<template>
  <div class="flex gap-1 w-full">
    <UserAvatar :animated="true" class="w-20"/>
    <div class="w-full">
      <div class="flex justify-between items-baseline">
        <h2 class="text-base font-bold">{{roomStore.currentRoom?.name || 'Loading...'}}</h2>        
        <UDrawer>
          <UButton icon="i-lucide-trophy" class="px-2 py-1 font-bold" size="sm">1</UButton>

          <template #content>
            <div class="px-3 mt-2">
              <SectionTitle>Room Level & Rewards</SectionTitle>
              <UTable :columns="columns" :data="data" sticky class="rounded-t-lg inset-shadow-sm inset-shadow-neutral-600 mt-2 w-full" />
            </div>
          </template>
        </UDrawer>
      </div>
      <div class="flex justify-between items-baseline">
        <h2 class="text-base font-bold">Followers: 750</h2>
        <NuxtLink 
          v-if="roomStore.currentRoom?.user?.signature"
          :to="`/profile/owner-`+ roomStore.currentRoom.user.signature"
          @click="roomStore.minimizeRoom()"
        >
          <ProfileBadge :show-badge="false" :txt="roomStore.currentRoom?.user?.signature" />
        </NuxtLink>        
        <ProfileBadge v-else :show-badge="false" />
      </div>
    </div>
  </div>
</template>