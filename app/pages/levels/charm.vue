<script setup lang="ts">
import { h, ref, resolveComponent } from "vue";
import type { ColumnDef } from "@tanstack/vue-table";

definePageMeta({ layout: 'alt' })

const value = ref(70)

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
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/levels/wealth/" second-link="/levels/charm/">
      <template #first-link-text>Wealth Level</template>
      <template #second-link-text>Charm Level</template>
    </NavAlt>

    <AltHero class="z-10" image-src="/siteAssets/alt-hero/secondary.webp">
      <div class="p-2 w-full h-full bg-gradient-to-br to-secondary/30">
        <div class="grid grid-cols-9 gap-1">
          <UserAvatar :animated="true" class="col-span-2" />
          <div class="col-span-5 flex flex-col justify-center">
            <p class="text-base font-semibold">@UsersSignature</p>
            <p class="text-lg font-bold">User Name</p>
          </div>
          <div class="col-span-2 flex flex-col justify-center">
            <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" class="ml-auto" color="secondary" txt="1"/>
          </div>
        </div>
        <UProgress v-model="value" color="secondary" />
        <div class="flex justify-between items-center">
          <p class="text-md font-bold">LvL: 1</p>
          <p class="text-md font-bold">LvL: 2</p>
        </div>
        <p class="text-base font-bold bg-elevated rounded-md border-2 border-secondary px-2 py-1 leading-tight text-shadow-md">
          You have <span class="text-secondary">9560.4 (XP)</span> You Need <span class="text-secondary">1058.4 (XP)</span> Experience Points more to reach Level 2
        </p>
      </div>
    </AltHero>

    <div class="px-3 my-14">
      <div class="flex gap-2 items-center">
        <NuxtImg
            provider="imagekit"
            src="/siteAssets/badges/badge-wealth-level-3.webp"
            class="w-8 relative z-10 shrink-0"
            width="18"
            height="18"
            format="webp"
            densities="x1 x2"
            sizes="64px"
            loading="lazy"
        />
        <h2 class="text-lg font-bold">Level Description</h2>
      </div>
      <p class="text-sm font-semibold text-muted mt-1">
        1 Coin Is Equal to 1 Experience Point as your level upgrades the color of your level icons will change accordingly.
      </p>

      <UTable :columns="columns" :data="data" sticky class="border border-secondary rounded-lg shadow-lg shadow-secondary/30 mt-2 w-full" />
    </div>
  </main>
</template>
<style scoped>

</style>