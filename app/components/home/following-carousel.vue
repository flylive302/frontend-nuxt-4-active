<script setup lang="ts">
// ========================================
// Home Following Carousel
// ========================================
// Displays ranked following users in a draggable horizontal carousel.
// Each card links to /profile/{signature}.
// Uses UCarousel (Embla) with dragFree for momentum scrolling.

import type { FollowingCard } from '~/composables/user/useFollowingData'

defineOptions({ name: 'HomeFollowingCarousel' })

defineProps<{
  users: FollowingCard[]
}>()
</script>

<template>
  <section aria-label="Following">
    <UCarousel
      :items="users"
      :drag-free="true"
      :align="'start'"
      :contain-scroll="'trimSnaps'"
      :ui="{ item: 'basis-24' }"
    >
      <template #default="{ item, index }">
        <NuxtLink
          :to="`/profile/${item.signature}`"
          class="following-card flex flex-col items-center gap-1 active:scale-95 transition-transform duration-150 "
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <UserAvatar
            :animated="true"
            :frame-asset-url="item.frame ?? undefined"
            :img="item.avatar ?? '/AppImages/dummy-card/avatar.png'"
            class="w-14"
          />
          <div class="marquee-container w-full -mt-2 pl-8">
            <span class="text-xs text-center font-semibold w-full leading-tight marquee-text">
              {{ item.name }}
            </span>
          </div>
          <ProfileBadge :txt="item.signature" :show-badge="false" />
        </NuxtLink>
      </template>
    </UCarousel>
  </section>
</template>

<style scoped>
/* Staggered fade-in on mount — each card enters with a slight delay */
.following-card {
  opacity: 0;
  animation: card-enter 300ms ease-out forwards;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
