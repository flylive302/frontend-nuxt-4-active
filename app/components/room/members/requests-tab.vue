<script setup lang="ts">
// ========================================
// Requests Tab
// ========================================
// Pending join requests list + approve/reject. INTENT-only: binds to
// useRoomJoinRequests.

import type { RoomJoinRequest } from "~/types/room/room";

// ========================================
// Composables
// ========================================

const { joinRequests, approveJoinRequest, rejectJoinRequest, isRequestActionPending } = useRoomJoinRequests();

// ========================================
// Handlers
// ========================================

async function handleApprove(request: RoomJoinRequest) {
  await approveJoinRequest(request.id);
}

async function handleReject(request: RoomJoinRequest) {
  await rejectJoinRequest(request.id);
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="joinRequests.loading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
    </div>
    <div
      v-else-if="joinRequests.items.length === 0"
      class="text-center py-8 text-muted"
    >
      No pending requests
    </div>
    <div
      v-for="request in joinRequests.items"
      v-else
      :key="request.id"
      class="bg-linear-to-bl to-neutral-950 rounded-lg border border-primary/30 overflow-hidden"
    >
      <MinimalUserList :user="request.user">
        <template #actions>
          <div v-if="request.message" class="p-2 bg-muted/20">
            <p class="text-sm italic">"{{ request.message }}"</p>
          </div>

          <div class="flex">
            <UButton
              color="success"
              variant="soft"
              class="flex-1 justify-center rounded-none"
              :disabled="isRequestActionPending(request.id)"
              :loading="isRequestActionPending(request.id)"
              @click="handleApprove(request)"
            >
              Approve
            </UButton>
            <UButton
              variant="soft"
              color="error"
              class="flex-1 justify-center rounded-none"
              :disabled="isRequestActionPending(request.id)"
              :loading="isRequestActionPending(request.id)"
              @click="handleReject(request)"
            >
              Reject
            </UButton>
          </div>
        </template>
      </MinimalUserList>
    </div>
  </div>
</template>
