<script setup lang="ts">
/**
 * Gift Drawer
 *
 * Main gift sending interface with recipient selection,
 * gift browsing, and send controls.
 */
import type { Gift } from '~/types/gift/gift';
import { useGiftData } from '~/composables/gift/useGiftData';
import { useGiftSending } from '~/composables/gift/useGiftSending';
import { GIFT_QUANTITY_OPTIONS } from '~/constants/gift';

// Quantity options for select (mutable array for USelect compatibility)
const quantityOptions = [...GIFT_QUANTITY_OPTIONS];

const giftStore = useGiftStore();
const authStore = useAuthStore();
const { giftsByCategory, ensureLoaded, isLoading } = useGiftData();
const { totalCost, canSend, send, isSending } = useGiftSending();

// Track drawer open state
const isOpen = ref(false);

// Load gifts when drawer might be opened
onMounted(() => {
  ensureLoaded();
});

// Auto-select all recipients when drawer opens (per spec: default is "all")
watch(isOpen, (open) => {
  if (open && giftStore.eligibleRecipients.length > 0) {
    giftStore.selectAllRecipients();
  }
});

/**
 * Handle gift selection
 */
function handleSelectGift(gift: Gift) {
  giftStore.selectGift(gift);
}

/**
 * Handle send button click
 */
async function handleSend() {
  await send();
}
</script>

<template>
  <UDrawer v-model:open="isOpen" title="Send Gift" description="Send gifts to speakers in the room">
    <!-- Trigger Button -->
    <NuxtImg src="/room/gift-box.png" alt="gifts" class="w-12 cursor-pointer" />

    <template #content>
      <div class="p-2 space-y-3">

        <!-- Recipient Selector -->
        <RoomGiftRecipientSelector />

        <!-- Category Tabs with Gift Grid -->
        <RoomGiftCategoryTabs :categories="giftsByCategory">
          <template #content="{ item }">
            <RoomGiftGrid
              :gifts="item.gifts"
              :selected-gift-id="giftStore.selectedGift?.id"
              @select="handleSelectGift"
            />
          </template>
        </RoomGiftCategoryTabs>

        <!-- Send Controls -->
        <div class="flex items-center justify-between pt-1 border-t border-muted">
          <!-- Coin Balance -->
          <div class="flex items-center">
            <UButton icon="i-lucide-coins" variant="subtle" color="warning" size="sm">
              {{ (authStore.user?.coins ?? 0).toLocaleString() }}
            </UButton>
            <UButton to="/wallet/purchase-coins" variant="soft" color="primary" size="xs">
              Recharge
            </UButton>
          </div>

          <div>
            <!-- Total Cost Display -->
            <div v-if="totalCost > 0" class="text-sm">
              <span class="text-gray-400">Total:</span>
              <span class="font-bold text-warning ml-1">
              🪙 {{ totalCost.toLocaleString() }}
            </span>
            </div>

            <!-- Quantity Selector -->
            <UFieldGroup class="flex items-center">
              <USelect
                  :model-value="giftStore.selectedQuantity"
                  :items="quantityOptions"
                  size="sm"
                  class="w-20 rounded-full overflow-hidden"
                  @update:model-value="(val: number) => giftStore.setQuantity(val)"
              />
              <!-- Send Button -->
              <UButton
                  :disabled="!canSend || isSending"
                  :loading="isSending"
                  size="sm"
                  trailing-icon="i-lucide-send"
                  @click="handleSend"
              >
                Send
              </UButton>
            </UFieldGroup>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-center py-4">
          <UIcon name="i-lucide-loader-2" class="animate-spin size-6" />
        </div>
      </div>
    </template>
  </UDrawer>
</template>
