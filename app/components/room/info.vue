<script setup lang="ts">
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useRoomAudio } from '~/composables/room/useRoomAudio'
import { useRoomGiftLeaderboard } from '~/composables/room/useRoomGiftLeaderboard'
import type { LeaderboardPeriod, LeaderboardEntry } from '~/types/progression/leaderboard'


// ========================================
// Composables
// ========================================

const roomStore = useRoomStore()
const audioStore = useRoomAudioStore()
const seatsStore = useRoomSeatsStore()
const { inviteToSeat } = useRoomAudio()

// ========================================
// Leaderboard Composable
// ========================================

const currentRoomId = computed(() => roomStore.currentRoom?.id ?? 0)
const {
  entries: leaderboardEntries,
  loading: leaderboardLoading,
  refreshing: leaderboardRefreshing,
  error: leaderboardError,
  hasFetched,
  fetch: fetchLeaderboard,
  refresh: refreshLeaderboard,
  setPeriod,
} = useRoomGiftLeaderboard(() => currentRoomId.value)

// Map entries to add flat `id` for vue-virtual-scroller key-field
const leaderboardItems = computed(() =>
  leaderboardEntries.value
    .filter((entry: LeaderboardEntry) => entry.user !== null)
    .map((entry: LeaderboardEntry) => ({
      ...entry,
      id: entry.user_id,
    }))
)

// ========================================
// Tab Configuration
// ========================================

const periodTabs = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'All Time', value: 'all_time' },
]

const activePeriod = ref<LeaderboardPeriod>('daily')

/**
 * Handle tab change - update period filter.
 */
function onTabChange(value: string | number): void {
  activePeriod.value = value as LeaderboardPeriod
  setPeriod(value as LeaderboardPeriod)
}

// ========================================
// Participants (Right Drawer)
// ========================================

const participants = computed(() => audioStore.participantList)
const participantCount = computed(() => audioStore.participantList.length)

// Owner check and active seat for invite functionality
const { isRoomOwner } = useRoomPermissions()
const activeSeatIndex = computed(() => seatsStore.activeSeat) // 0-indexed, null if none

// ========================================
// Invite Functionality
// ========================================

const isInviting = ref(false)
const inviteModeSeat = computed(() => seatsStore.inviteModeSeat)

// ========================================
// Drawer State
// ========================================

const isOpenLeft = ref(false)
const isOpenRight = ref(false)

// Lazy fetch leaderboard on drawer open (also handles late room ID availability)
watch(
  [isOpenLeft, currentRoomId],
  ([open, roomId]) => {
    if (open && roomId && !hasFetched.value) {
      fetchLeaderboard(true)
    }
  },
  { immediate: true }
)

// Auto-open drawer when invite mode starts
watch(inviteModeSeat, (newVal) => {
  if (newVal !== null) {
    isOpenRight.value = true
  }
})

// Cancel invite mode when drawer is closed
watch(isOpenRight, (isOpen) => {
  if (!isOpen && inviteModeSeat.value !== null) {
    seatsStore.cancelInviteMode()
  }
})

// ========================================
// Handlers
// ========================================

async function handleInvite(userId: number) {
  // Use inviteModeSeat if available, otherwise fallback to activeSeat (legacy)
  const targetSeat = inviteModeSeat.value !== null
    ? inviteModeSeat.value
    : activeSeatIndex.value

  if (targetSeat === null) return

  isInviting.value = true
  try {
    await inviteToSeat(userId, targetSeat)
    seatsStore.cancelInviteMode()
    isOpenRight.value = false
  } finally {
    isInviting.value = false
  }
}

const roomXp = computed(() => roomStore.currentRoom?.room_xp)

/**
 * Get rank badge color based on position.
 */
function getRankColor(rank: number): 'primary' | 'secondary' | 'tertiary' | 'neutral' {
  const colors = ['primary', 'secondary', 'tertiary'] as const
  if (rank >= 1 && rank <= 3) {
    return colors[rank - 1]!
  }
  return 'neutral'
}

/**
 * Get rank badge variant based on position.
 */
function getRankVariant(rank: number): 'solid' | 'soft' {
  return rank >= 1 && rank <= 3 ? 'solid' : 'soft'
}
</script>

<template>
  <div class="flex justify-between items-center my-1">
    <!-- Left Drawer: Room Activity -->
    <UDrawer v-model:open="isOpenLeft" direction="left" title="Room Activity" description="View daily, weekly, and monthly room activity rankings.">
      <UButton
        variant="subtle" icon="i-lucide-coins" size="xs"
        class="cursor-pointer shadow-md backdrop-blur-xs font-bold"
      >
        {{formatCurrency(roomXp)}}
      </UButton>

      <template #content>
        <div class="mt-2 pl-1 min-w-11/12 h-full flex flex-col">
          <div class="flex items-baseline justify-between shrink-0 gap-2">
            <SectionTitle>Room Activity</SectionTitle>
            <div class="flex items-center gap-2">
              <UButton
                variant="ghost"
                icon="i-lucide-refresh-cw"
                size="xs"
                :loading="leaderboardRefreshing"
                :disabled="leaderboardLoading"
                @click="refreshLeaderboard"
              />
              <UButton
                variant="soft" icon="i-lucide-coins" size="xs"
                class="cursor-pointer text-primary shadow-md backdrop-blur-xs font-bold"
              >
                {{ formatCurrency(roomXp) }}
              </UButton>
            </div>
          </div>

          <UTabs
            :items="periodTabs"
            :model-value="activePeriod"
            variant="link"
            :ui="{ trigger: 'grow' }"
            class="w-full"
            @update:model-value="onTabChange"
          />

          <!-- Tab Content (rendered outside UTabs in Nuxt UI 4) -->
          <div
            class="p-2 h-[84vh] bg-neutral-800 rounded-lg inset-shadow-sm inset-shadow-neutral-700 overflow-hidden mt-2"
          >
            <!-- Loading State -->
            <div v-if="leaderboardLoading && !leaderboardItems.length" class="flex items-center justify-center h-full">
              <div class="flex flex-col items-center gap-3 text-gray-400">
                <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
                <span>Loading leaderboard...</span>
              </div>
            </div>

            <!-- Error State -->
            <div v-else-if="leaderboardError" class="flex items-center justify-center h-full">
              <div class="flex flex-col items-center gap-3 text-red-400">
                <UIcon name="i-lucide-alert-circle" class="w-8 h-8" />
                <span>{{ leaderboardError }}</span>
                <UButton size="xs" variant="soft" @click="refreshLeaderboard">
                  Retry
                </UButton>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="!leaderboardItems.length && hasFetched" class="flex items-center justify-center h-full">
              <div class="flex flex-col items-center gap-3 text-gray-400">
                <UIcon name="i-lucide-gift" class="w-8 h-8 opacity-50" />
                <span>No gifts in this period</span>
              </div>
            </div>

            <!-- Leaderboard List -->
            <DynamicScroller
              v-else
              :items="leaderboardItems"
              :min-item-size="70"
              class="h-full"
              key-field="id"
            >
              <template #default="{ item: entry, index, active }">
                <DynamicScrollerItem :item="entry" :active="active" :data-index="index" class="pb-3">
                  <div class="flex gap-2 items-center justify-between w-full">
                    <UBadge
                        :color="getRankColor(entry.rank)"
                        :variant="getRankVariant(entry.rank)"
                        size="sm"
                        class="font-bold"
                        :class="`text-${getRankColor(entry.rank)}-100`"
                    >
                      {{ entry.rank }}
                    </UBadge>

                    <MinimalUserList class="grow" :user="entry.user">
                      <UButton size="xs" variant="soft" color="tertiary" icon="i-lucide-coins" class="mr-1 px-1">
                        {{ formatCurrency(entry.total_value) }}
                      </UButton>
                    </MinimalUserList>
                  </div>
                </DynamicScrollerItem>
              </template>
            </DynamicScroller>
          </div>
        </div>
      </template>
    </UDrawer>

    <!-- Right Drawer: Active Users -->
    <UDrawer v-model:open="isOpenRight" direction="right" title="Users in Room" description="View a list of all current participants in the room.">
      <UButton
        variant="subtle" icon="i-lucide-users-round" size="xs"
        class="cursor-pointer shadow-md backdrop-blur-xs font-bold"
      >
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
                  <RoomParticipantListItem
                    :participant="item"
                    :invite-mode-seat="inviteModeSeat"
                    :is-room-owner="isRoomOwner"
                    :is-inviting="isInviting"
                    @invite="handleInvite"
                  />
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