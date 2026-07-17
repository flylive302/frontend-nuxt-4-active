<script setup lang="ts">
// ========================================
// Blocked Tab
// ========================================
// Blocked users list + unblock. INTENT-only: state comes from the parent
// (single shared useRoomBlocking() instance — its state is a local ref, not
// store-backed, so ownership must stay with one caller); unblock is
// delegated back up.

import type { RoomBlock } from "~/types/room/room";

defineProps<{
  blockedUsers: RoomBlock[];
  loading: boolean;
}>();

const emit = defineEmits<{
  unblock: [userId: number];
}>();
</script>

<template>
  <div class="space-y-2">
    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
    </div>
    <div
      v-else-if="blockedUsers.length === 0"
      class="text-center py-8 text-muted"
    >
      No blocked users
    </div>
    <div
      v-for="block in blockedUsers"
      v-else
      :key="block.id"
      class="flex items-center gap-3 p-2 rounded-lg bg-elevated/30"
    >
      <LazyUserAvatar :img="block.user?.avatar" class="size-10" />
      <div class="flex-1 min-w-0">
        <p class="font-medium truncate">{{ block.user?.name }}</p>
        <p class="text-xs text-muted">
          {{
            block.is_permanent
              ? "Permanent"
              : `Until ${new Date(block.banned_until!).toLocaleDateString()}`
          }}
        </p>
      </div>
      <UButton
        icon="i-lucide-unlock"
        color="success"
        variant="ghost"
        size="sm"
        @click="emit('unblock', block.user.id)"
      >
        Unblock
      </UButton>
    </div>
  </div>
</template>
