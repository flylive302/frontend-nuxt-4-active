<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { h, computed, resolveComponent } from 'vue';
import type { ColumnDef } from '@tanstack/vue-table';
import type { LevelConfig } from '~/types/bootstrap';

// ========================================
// Stores
// ========================================

const roomStore = useRoomStore();
const bootstrapStore = useBootstrapStore();

// ========================================
// Types
// ========================================

interface RoomLevelRow {
  level: string;
  requiredXP: string;
  badge: {
    badgeSrc: string;
    color: string;
    txt: string;
    class?: string;
  };
}

// ========================================
// Table Setup
// ========================================

const profileBadge = resolveComponent('ProfileBadge');

const columns: ColumnDef<RoomLevelRow>[] = [
  {
    accessorKey: 'level',
    header: 'Level',
  },
  {
    accessorKey: 'requiredXP',
    header: 'Required XP',
  },
  {
    accessorKey: 'badge',
    header: 'Badge',
    cell: ({ getValue }) => {
      const badge = getValue() as RoomLevelRow['badge'] | undefined;

      if (!badge) {
        return null;
      }

      return h(profileBadge, {
        class: badge.class + ' mx-auto',
        badgeSrc: badge.badgeSrc,
        color: badge.color,
        txt: badge.txt,
      });
    },
  },
];

// ========================================
// Computed
// ========================================

/** Room level config from bootstrap store */
const levelConfig = computed<LevelConfig[]>(() => 
  bootstrapStore.config?.room_levels ?? []
);

/** Current room level */
const currentLevel = computed(() => 
  roomStore.currentRoom?.current_level ?? 0
);

/** Table data derived from room level config */
const tableData = computed<RoomLevelRow[]>(() => 
  levelConfig.value.map((item) => {
    // Look up badge by badge_id using bootstrapStore.badgeMap
    const badge = item.badge_id ? bootstrapStore.badgeMap.get(item.badge_id) : null;
    return {
      level: item.name,
      requiredXP: item.required_xp.toLocaleString() + ' XP',
      badge: {
        badgeSrc: badge?.image_url || '/badges/room/level_1.webp',
        color: 'primary',
        txt: String(item.level),
        class: item.level === currentLevel.value 
          ? 'border border-primary bg-primary/10 rounded-md px-2 py-1 inset-shadow-sm ' 
          : '',
      },
    };
  })
);

/** Loading state */
const loading = computed(() => !bootstrapStore.isReady);
</script>

<template>
  <div class="flex gap-1 w-full">
    <UserAvatar :animated="true" :img="roomStore.currentRoom?.logo" class="w-20"/>
    <div class="w-full">
      <div class="flex justify-between items-baseline">
        <h2 class="text-base font-bold">{{ roomStore.currentRoom?.name || 'Loading...' }}</h2>        
        <UDrawer title="Room Level & Rewards" description="View the current room level and associated rewards.">
          <UButton icon="i-lucide-trophy" class="px-2 py-1 font-bold" size="sm">
            {{ currentLevel }}
          </UButton>

          <template #content>
            <div class="px-3 mt-2 h-full">
              <SectionTitle>Room Level & Rewards</SectionTitle>
              
              <!-- Loading Skeleton -->
              <div v-if="loading" class="mt-2 space-y-2">
                <div v-for="i in 5" :key="i" class="h-12 bg-muted rounded animate-pulse" />
              </div>
              
              <!-- Room Levels Table -->
              <UTable 
                v-else-if="tableData.length > 0"
                :columns="columns" 
                :data="tableData" 
                sticky 
                class="border border-primary rounded-lg shadow-lg shadow-primary/30 mt-2 w-full h-[calc(100vh-200px)] mb-4" 
              />
              
              <!-- Empty State -->
              <p v-else class="text-muted text-center py-8">
                No room level data available.
              </p>
            </div>
          </template>
        </UDrawer>
      </div>
      <div class="flex justify-between items-baseline">
        <h2 class="text-base font-bold">Followers: 750</h2>
        <NuxtLink 
          v-if="roomStore.currentRoom?.owner?.signature"
          :to="`/profile/`+ roomStore.currentRoom.owner.signature"
          @click="roomStore.minimizeRoom()"
        >
          <ProfileBadge :show-badge="false" :txt="roomStore.currentRoom?.owner?.signature" />
        </NuxtLink>        
        <ProfileBadge v-else :show-badge="false" />
      </div>
    </div>
  </div>
</template>