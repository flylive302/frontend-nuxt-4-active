<script setup>
import { createLogger } from '~/utils/logger';

const log = createLogger('[HomeFooter]');

const authStore = useAuthStore();
const roomStore = useRoomStore();
const notificationStore = useNotificationStore();
const route = useRoute();
const room = useRoom();

const createRoomOpen = ref(false);
const navRef = ref(null);
const indicatorX = ref(0);

const navItems = [
  { to: '/', index: 0 },
  { to: '/discover-all-events', index: 1 },
  { to: null, index: 2 },
  { to: '/notifications', index: 3 },
  { to: '/profile', index: 4 },
];

const activeIndex = computed(() => {
  const match = navItems.find(item => item.to && route.path === item.to);
  return match?.index ?? 2;
});

function updateIndicator() {
  if (!navRef.value) return;
  const activeEl = navRef.value.querySelectorAll(':scope > *')[activeIndex.value];
  if (!activeEl) return;
  const navRect = navRef.value.getBoundingClientRect();
  const elRect = activeEl.getBoundingClientRect();
  indicatorX.value = elRect.left - navRect.left + elRect.width / 2 - 24;
}

watch(activeIndex, async () => { await nextTick(); updateIndicator(); });
onMounted(async () => { await nextTick(); updateIndicator(); });

async function handleMyRoomClick() {
  try {
    await room.fetchUserRoom();
    if (roomStore.userRoom) {
      roomStore.setCurrentRoom(roomStore.userRoom);
      await navigateTo(`/room/${roomStore.userRoom.id}`);
    } else {
      createRoomOpen.value = true;
    }
  } catch (error) {
    log.error('Failed to fetch user room:', error);
  }
}
</script>

<template>
  <footer aria-label="Primary" class="fixed inset-x-2 z-50 bottom-4">
    <div
        class="bg-primary rounded-full size-12 absolute top-2 left-0 transition-transform duration-300 animate-pulse"
        :style="{ transform: `translateX(${indicatorX}px)` }"
    />
    <div
        ref="navRef"
        class="grid grid-cols-5 items-center gap-8 px-2 py-1 touch-manipulation select-none ring-2 ring-white/10 rounded-xl backdrop-blur-sm bg-linear-to-br to-primary/10"
    >
      <NuxtLink to="/" class="flex-middle"><UIcon name="i-lucide-home" class="size-8" /></NuxtLink>
      <NuxtLink to="/discover-all-events" class="flex-middle"><UIcon name="i-lucide-contact-round" class="size-8" /></NuxtLink>
      <NuxtLink class="flex-middle" @click="handleMyRoomClick"><UIcon name="i-lucide-door-open" class="size-8" /></NuxtLink>
      <NuxtLink to="/notifications" class="flex-middle relative">
        <UIcon name="i-lucide-bell-plus" class="size-8" />
        <span
            v-if="notificationStore.unreadBadge"
            class="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center"
        >
          {{ notificationStore.unreadBadge }}
        </span>
      </NuxtLink>
      <NuxtLink to="/profile" aria-label="Profile" class="justify-self-end">
        <UserAvatar
            class="w-13"
            :animated="true"
            :frame-asset-url="authStore?.user?.frame ?? undefined"
            :img="authStore.user?.avatar || undefined"
        />
      </NuxtLink>
    </div>

    <UDrawer v-model:open="createRoomOpen" title="Create your Room" description="Start your journey by creating your own room.">
      <template #content>
        <div class="safe-area-bottom p-4 pb-8">
          <RoomCreate @success="createRoomOpen = false" />
        </div>
      </template>
    </UDrawer>
  </footer>
</template>