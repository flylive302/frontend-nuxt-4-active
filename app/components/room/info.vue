<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'
import { ref } from 'vue'
import { useRoomAudio } from '~/composables/useRoomAudio'

const roomStore = useRoomStore()
const { inviteToSeat } = useRoomAudio()

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

// TODO: Replace with real API data when room activity leaderboard is implemented
const dailyUsers = ref<RoomUser[]>([])

// Real participants from room store
const participants = computed(() => roomStore.participantList)
const participantCount = computed(() => roomStore.participantList.length)

// Owner check and active seat for invite functionality
const isRoomOwner = computed(() => roomStore.isRoomOwner)
const activeSeat = computed(() => roomStore.activeSeat) // 1-indexed, null if none
const activeSeatIndex = computed(() => activeSeat.value ? activeSeat.value - 1 : null) // 0-indexed

// Invite to seat functionality
const isInviting = ref(false)
const inviteModeSeat = computed(() => roomStore.inviteModeSeat)

// Drawer state - must be declared before watchers that reference them
const isOpenLeft = ref(false)
const isOpenRight = ref(false)

// Auto-open drawer when invite mode starts
watch(inviteModeSeat, (newVal) => {
  if (newVal !== null) {
    isOpenRight.value = true
  }
})

// Cancel invite mode when drawer is closed
watch(isOpenRight, (isOpen) => {
  if (!isOpen && inviteModeSeat.value !== null) {
    roomStore.cancelInviteMode()
  }
})

async function handleInvite(userId: number) {
  // Use inviteModeSeat if available, otherwise fallback to activeSeat (legacy)
  const targetSeat = inviteModeSeat.value !== null
    ? inviteModeSeat.value
    : activeSeatIndex.value

  if (targetSeat === null) return

  isInviting.value = true
  try {
    await inviteToSeat(userId, targetSeat)
    // If successful, we can perhaps close the drawer or cancel mode?
    // User flow: Select user -> sent -> done.
    roomStore.cancelInviteMode()
    isOpenRight.value = false // Optional: Close drawer after invite?
  } finally {
    isInviting.value = false
  }
}
</script>

<template>
  <div class="flex justify-between items-center my-1">
    <!-- Left Drawer: Room Activity -->
    <UDrawer v-model:open="isOpenLeft" direction="left" title="Room Activity" description="View daily, weekly, and monthly room activity rankings.">
      <UButton
variant="subtle" icon="i-lucide-coins" size="xs"
        class="cursor-pointer shadow-md backdrop-blur-xs font-bold">
        11.3 M
      </UButton>

      <template #content>
        <div class="mt-2 pl-1 min-w-11/12 h-full flex flex-col">
          <div class="flex items-baseline justify-between shrink-0">
            <SectionTitle>Room Activity</SectionTitle>
            <UButton
variant="soft" icon="i-lucide-coins" size="xs"
              class="cursor-pointer text-primary shadow-md backdrop-blur-xs font-bold">
              11.3 M
            </UButton>
          </div>

          <UTabs :items="items" variant="link" :ui="{ trigger: 'grow' }" class="w-full h-full flex flex-col">
            <template #content>
              <div
                class="p-2 h-[84vh] bg-neutral-800 rounded-lg inset-shadow-sm inset-shadow-neutral-700 overflow-hidden">
                <DynamicScroller :items="dailyUsers" :min-item-size="70" class="h-full" key-field="id">
                  <template #default="{ item: user, index, active }">
                    <DynamicScrollerItem :item="user" :active="active" :data-index="index" class="pb-3">
                      <RoomLeaderboardItem :user="user" />
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
    <UDrawer v-model:open="isOpenRight" direction="right" title="Users in Room" description="View a list of all current participants in the room.">
      <UButton
variant="subtle" icon="i-lucide-users-round" size="xs"
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