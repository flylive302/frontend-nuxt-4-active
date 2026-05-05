<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
const columns = [
  [
    { id: 1, name: 'Come Fly With ME', background: ASSETS.AUTH_CARD_1, primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: true },
    { id: 2, name: 'Faith', background: ASSETS.AUTH_CARD_2, primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
    { id: 3, name: 'Friend Zone', background: ASSETS.AUTH_CARD_3, primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
  ],
  [
    { id: 4, name: 'Ruby on Rails', background: ASSETS.AUTH_CARD_4, primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: true },
    { id: 5, name: 'Nightmare', background: ASSETS.AUTH_CARD_5, primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
    { id: 6, name: 'Cultural Loves', background: ASSETS.AUTH_CARD_6, primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
  ],
]
</script>

<template>
  <div class="flex gap-3 absolute inset-0 p-4 z-10" style="content-visibility: auto; contain-intrinsic-size: auto 100% auto 500px;">
    <div
      v-for="(column, i) in columns"
      :key="i"
      class="flex flex-col gap-4"
      :class="i === 0 ? 'animate-scroll-up' : 'animate-scroll-down'"
    >
      <template v-for="pass in 2" :key="pass">
        <AuthDummyRoomCard
          v-for="room in column"
          :key="`${pass}-${room.id}`"
          :room="room"
        />
      </template>
    </div>
  </div>
</template>
