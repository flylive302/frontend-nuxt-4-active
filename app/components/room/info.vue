<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { ref } from 'vue'

const roomStore = useRoomStore()

const items: TabsItem[] = [
  { label: 'Daily' },
  { label: 'Weekly' },
  { label: 'Monthly' }
]

interface RoomUser {
  id: number
  name: string
  rank: number
  wealthLevel: number
  charmLevel: number
  coins: string
  avatar: string
}

const generateUsers = (count: number): RoomUser[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    rank: i + 1,
    wealthLevel: (i % 5) + 1,
    charmLevel: (i % 5) + 1,
    coins: `${(Math.random() * 10).toFixed(1)} M`,
    avatar: '' // UserAvatar handles empty src
  }))
}

// Placeholder for room activity leaderboard (daily/weekly/monthly)
const dailyUsers = ref(generateUsers(50))

// Real participants from room store
const participants = computed(() => roomStore.participantList)
const participantCount = computed(() => roomStore.participantList.length)

const isOpenLeft = ref(false)
const isOpenRight = ref(false)
</script>

<template>
  <div class="flex justify-between items-center my-1">
    <!-- Left Drawer: Room Activity -->
    <UDrawer v-model:open="isOpenLeft" direction="left">
      <UButton variant="subtle" icon="i-lucide-coins" size="xs"
        class="cursor-pointer shadow-md backdrop-blur-xs font-bold">
        11.3 M
      </UButton>

      <template #content>
        <div class="mt-2 pl-1 min-w-11/12 h-full flex flex-col">
          <div class="flex items-baseline justify-between shrink-0">
            <SectionTitle>Room Activity</SectionTitle>
            <UButton variant="soft" icon="i-lucide-coins" size="xs"
              class="cursor-pointer text-primary shadow-md backdrop-blur-xs font-bold">
              11.3 M
            </UButton>
          </div>

          <UTabs :items="items" variant="link" :ui="{ trigger: 'grow' }" class="w-full h-full flex flex-col">
            <template #content="{ item }">
              <div
                class="p-2 h-[84vh] bg-neutral-800 rounded-lg inset-shadow-sm inset-shadow-neutral-700 overflow-hidden">
                <DynamicScroller :items="dailyUsers" :min-item-size="70" class="h-full" key-field="id">
                  <template #default="{ item, index, active }">
                    <DynamicScrollerItem :item="item" :active="active" :data-index="index" class="pb-3">
                      <div class="flex items-center justify-between w-full">
                        <UBadge :color="item.rank <= 3 ? ['primary', 'secondary', 'tertiary'][item.rank - 1] : 'gray'"
                          class="text-white font-bold" :label="item.rank" />
                        <div
                          class="flex gap-1 bg-gradient-to-br from-gray-800 to-black border-2 border-gray-700 rounded-lg shadow-md overflow-hidden flex-grow ml-2">
                          <UserAvatar animated class="w-14" />
                          <div class="flex flex-col justify-center min-h-full px-2">
                            <h3 class="text-sm font-bold leading-tight">{{ item.name }}
                              <icon name="i-lucide-mars" />
                            </h3>
                            <div class="flex items-center gap-1 mt-1">
                              <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary"
                                :txt="item.wealthLevel" />
                              <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary"
                                :txt="item.charmLevel" />
                            </div>
                          </div>

                          <div class="flex flex-col justify-center min-h-full ml-auto pr-2">
                            <UButton size="xs" variant="soft" icon="i-lucide-coins">{{ item.coins }}</UButton>
                          </div>
                        </div>
                      </div>
                    </DynamicScrollerItem>
                  </template>
                </DynamicScroller>
              </div>
            </template>
          </UTabs>
        </div>
      </template>
    </UDrawer>

    <!-- Right Drawer: Active Users -->
    <UDrawer v-model:open="isOpenRight" direction="right">
      <UButton variant="subtle" icon="i-lucide-users-round" size="xs"
        class="cursor-pointer shadow-md backdrop-blur-xs font-bold">
        {{ participantCount }}
      </UButton>

      <template #content>
        <div class="min-w-11/12 pr-2 h-full flex flex-col">
          <SectionTitle class="my-3 shrink-0">Users in Room ({{ participantCount }})</SectionTitle>
          <div class="p-2 h-[90vh] bg-neutral-800 rounded-lg inset-shadow-sm inset-shadow-neutral-700 overflow-hidden">
            <!-- Active Room Participants List -->
            <DynamicScroller :items="participants" :min-item-size="70" class="h-full" key-field="id">
              <template #default="{ item, index, active }">
                <DynamicScrollerItem :item="item" :active="active" :data-index="index" class="pb-3">
                  <div
                    class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
                    <UserAvatar :img="item.avatar" animated class="w-13" />
                    <div class="flex flex-col justify-center min-h-full px-2">
                      <h3 class="text-sm font-bold leading-tight">
                        {{ item.name }}
                        <UBadge v-if="item.isSpeaker" size="xs" color="primary" class="ml-1">Speaker</UBadge>
                      </h3>
                      <div class="flex items-center gap-1 mt-1">
                        <span class="text-xs text-gray-400">ID: {{ item.id }}</span>
                      </div>
                    </div>
                  </div>
                </DynamicScrollerItem>
              </template>
            </DynamicScroller>

            <!-- Empty state -->
            <div v-if="participants.length === 0" class="flex items-center justify-center h-full text-gray-400">
              <span>No participants in room</span>
            </div>
          </div>
        </div>
      </template>
    </UDrawer>
  </div>
</template>