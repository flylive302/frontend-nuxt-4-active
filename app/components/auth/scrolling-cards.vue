<script setup lang="ts">
const columns = [
  [
    { id: 1, name: 'Random Name', logo: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', background: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: true },
    { id: 2, name: 'Random Name 2', logo: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', background: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
    { id: 3, name: 'Random Name 3', logo: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', background: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
  ],
  [
    { id: 4, name: 'Random Name', logo: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', background: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: true },
    { id: 5, name: 'Random Name 2', logo: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', background: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
    { id: 6, name: 'Random Name 3', logo: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', background: 'https://ik.imagekit.io/flylive/siteAssets/room/room-card-top.webp', primary_color: 'orange', country: 'US', room_xp: 48970, current_level: 10, is_live: true, participant_count: 12, is_locked: false },
  ],
]
</script>

<template>
  <div class="flex gap-3 absolute inset-0 p-4" style="content-visibility: auto; contain-intrinsic-size: auto 100% auto 500px;">
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
