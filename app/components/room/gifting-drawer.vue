<script setup lang="ts">
/**
 * RoomGiftingDrawer - Gift sending interface
 * Allows users to select recipients and send gifts via socket
 */
import { ref } from 'vue';
import type { TabsItem } from '@nuxt/ui'
import { getGiftsByCategory } from '~/types/gift';
const authStore = useAuthStore();
const roomStore = useRoomStore();

// Gift categories
const categories = getGiftsByCategory();

// Selected recipients (user IDs)
const selectedRecipients = ref<number[]>([]);
const selectedGiftId = ref<number | null>(null);

// Get participants for recipient selection
const participants = computed(() => roomStore.participantList);

// Toggle recipient selection
function toggleRecipient(userId: number) {
  const index = selectedRecipients.value.indexOf(userId);
  if (index === -1) {
    selectedRecipients.value.push(userId);
  } else {
    selectedRecipients.value.splice(index, 1);
  }
}

// Select all recipients
function selectAllRecipients() {
  selectedRecipients.value = participants.value.map((p) => p.id);
}

// Handle gift selection
function selectGift(giftId: number) {
  selectedGiftId.value = giftId;
}

</script>

<template>
  <UDrawer title="Gifting Area" description="Gifting Area for Sending Gifts to users in room">
    <NuxtImg src="/room/gift-box.png" alt="room prop" class="w-12" />
    <template #content>
      <div class="px-2 my-2">
        <!-- Recipients Selection -->
        <div class="flex justify-between items-center">
          <div class="flex gap-1">
            <div>
              <UButton size="xs" square class="rounded-full" @click="selectAllRecipients">
                All
              </UButton>
            </div>

            <div class="flex items-center w-48 overflow-x-scroll scrollbar gap-0.5">
              <template v-if="participants.length > 0">
                <UUser
                  v-for="participant in participants"
                  :key="participant.id"
                  :avatar="{
                    src: participant.avatar || 'https://i.pravatar.cc/150',
                    class: selectedRecipients.includes(participant.id) ? 'ring-2 ring-primary' : 'border',
                  }"
                  chip
                  size="sm"
                  @click="toggleRecipient(participant.id)"
                />
              </template>
              <template v-else>
                <span class="text-xs text-gray-400">No participants</span>
              </template>
            </div>
          </div>

          <UButton size="xs">Info</UButton>
        </div>

        <!-- Gift Categories & Grid -->
        <UTabs
          color="primary"
          variant="link"
          size="xs"
          :items="categories"
          class="w-full"
          :ui="{
            list: 'max-w-full !overflow-x-scroll !overflow-y-none',
            indicator: 'bottom-1',
            trigger: 'min-w-fit',
            content: 'grid grid-cols-4 gap-1 bg-accented inset-shadow-sm inset-shadow-neutral-950 rounded-md p-2 max-h-[30vh] overflow-y-scroll',
          }"
        >
          <template #content="{ item }">
            <RoomGiftCard
              v-for="i in item.gifts"
              :key="i"
              :category="item.category"
              :name="i.name"
              :price="i.price"
              :class="selectedGiftId == i.id ? 'ring-2 ring-primary' : 'border'"
              @click="selectGift(i.id)"
            />
          </template>
        </UTabs>

        <RoomPlayGift
          :selected-gift-id="selectedGiftId"
          :selected-recipients="selectedRecipients"
        />
      </div>
    </template>
  </UDrawer>
</template>