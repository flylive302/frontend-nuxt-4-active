<script setup>
import {useRoom} from "~/composables/useRoom";
import { createLogger } from '~/utils/logger';

const log = createLogger('[HomeFooter]');

const authStore = useAuthStore();
const roomStore = useRoomStore();
const notificationStore = useNotificationStore();

const createRoomOpen = ref(false);

const room = useRoom();

async function handleMyRoomClick() {
  try {
    await room.fetchUserRoom();

    if (roomStore.userRoom !== null) {
      roomStore.setCurrentRoom(roomStore.userRoom);
      createRoomOpen.value = false;
    } else {
      createRoomOpen.value = true;
    }
  } catch (error) {
    log.error('Failed to fetch user room:', error);
  }
}
</script>

<template>
  <footer
      aria-label="Primary"
      class="fixed inset-x-2 z-50 bottom-4"
  >
    <BgGlass
        class="border border-white/40"
        frost-blur-radius="blur(8px)"
        :noise-frequency="0.009"
        :noise-strength="200"
        rounded="rounded-lg"
    >
      <div class="grid grid-cols-5 items-center gap-8 px-2 touch-manipulation select-none">
        <UButton
            square
            to="/"
            aria-label="Home"
            icon="i-lucide-house"
            size="xl"
            color="primary"
            variant="solid"
            class="justify-center"
        />
        <UButton
            square
            aria-label="Contacts"
            icon="i-lucide-contact-round"
            size="xl"
            color="primary"
            variant="soft"
            class="justify-center size-10"
        />
        <UButton
            square
            aria-label="My Room"
            icon="i-lucide-door-open"
            size="xl"
            color="primary"
            variant="soft"
            class="justify-center size-10"
            @click="handleMyRoomClick"
        />

        <UButton
            square
            to="/notifications"
            aria-label="Notifications"
            icon="i-lucide-bell-plus"
            size="xl"
            color="primary"
            variant="soft"
            class="justify-center size-10 relative"
        >
          <span
            v-if="notificationStore.unreadBadge"
            class="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-error text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {{ notificationStore.unreadBadge }}
          </span>
        </UButton>
        <!-- Profile -->
        <NuxtLink
            to="/profile"
            aria-label="Profile"
            class="justify-self-end"
        >
          <UserAvatar class="w-13" :animated="true" :frame-name="authStore?.user?.frame ?? undefined" :img="authStore.user?.avatar || undefined" />
        </NuxtLink>
      </div>
    </BgGlass>
    <UDrawer v-model:open="createRoomOpen" title="Create your Room" description="Start your journey by creating your own room.">
      <template #content>
        <div class="safe-area-bottom p-4 pb-8">
          <RoomCreate @success="createRoomOpen = false" />
        </div>
      </template>
    </UDrawer>
  </footer>
</template>