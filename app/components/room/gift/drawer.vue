<script setup lang="ts">
/**
 * Gift Drawer
 *
 * Main gift sending interface with recipient selection,
 * gift browsing, and send controls.
 *
 * After a gift is sent, the send controls morph into an
 * inline combo button with a progress timer. When the combo
 * times out or the user selects a different gift, it morphs
 * back to the normal send controls.
 */
import type { Gift } from "~/types/gift/gift";
import { ASSETS } from '~/constants/assets';
import { formatCurrency } from '~/utils/currency';
import { useGiftData } from "~/composables/gift/useGiftData";
import { useGiftRecipientSync } from "~/composables/gift/useGiftRecipientSync";
import { useGiftSending } from "~/composables/gift/useGiftSending";
import { useGiftReadiness } from "~/composables/gift/useGiftReadiness";
import { GIFT_QUANTITY_OPTIONS, COMBO_BUTTON_TIMEOUT_MS } from "~/constants/gift";

// Quantity options for select (mutable array for USelect compatibility)
const quantityOptions = [...GIFT_QUANTITY_OPTIONS];

const giftStore = useGiftStore();
const comboStore = useGiftComboStore();
const authStore = useAuthStore();
const seatsStore = useRoomSeatsStore();
const { eligibleRecipients, selectAllRecipients } = useGiftEligibility();
const { giftsByCategory, ensureLoaded, isLoading } = useGiftData();
const { totalCost, canSend, send, isSending, combo, luckyCombo, endLuckyCombo } = useGiftSending();
const { readinessState } = useGiftReadiness(computed(() => giftStore.selectedGift));

const { haptic } = useHaptics();
useGiftRecipientSync();

const isSelectedGiftReady = computed(() => readinessState.value === 'ready');

// Track drawer open state
const isOpen = ref(false);

// ========================================
// Combo Mode State
// ========================================

const isComboMode = ref(false);
const comboType = ref<'normal' | 'lucky' | null>(null);
const comboProgress = ref(0);
let comboAnimFrameId: number | null = null;
let comboStartTime = 0;

/**
 * Start the combo progress animation (countdown bar)
 */
function startComboProgress() {
  stopComboProgress();
  comboProgress.value = 0;
  comboStartTime = performance.now();

  const update = (currentTime: number) => {
    const elapsed = currentTime - comboStartTime;
    const ratio = Math.min(elapsed / COMBO_BUTTON_TIMEOUT_MS, 1);
    comboProgress.value = Math.round(ratio * 100);

    if (ratio < 1) {
      comboAnimFrameId = requestAnimationFrame(update);
    } else {
      comboAnimFrameId = null;
      onComboTimeout();
    }
  };

  comboAnimFrameId = requestAnimationFrame(update);
}

/**
 * Reset the combo progress (on combo click)
 */
function resetComboProgress() {
  startComboProgress();
}

/**
 * Stop the combo progress animation
 */
function stopComboProgress() {
  if (comboAnimFrameId) {
    cancelAnimationFrame(comboAnimFrameId);
    comboAnimFrameId = null;
  }
}

/**
 * Enter combo mode after a successful send
 */
function enterComboMode(type: 'normal' | 'lucky') {
  isComboMode.value = true;
  comboType.value = type;
  startComboProgress();
}

/**
 * Exit combo mode — revert to normal send controls
 */
function exitComboMode() {
  const wasLucky = comboType.value === 'lucky';
  isComboMode.value = false;
  comboType.value = null;
  comboProgress.value = 0;
  stopComboProgress();
  if (wasLucky) {
    endLuckyCombo();
  } else {
    // Drop the normal combo context + streak badge once the combo window ends.
    comboStore.clearNormalContext();
    giftStore.resetCombo();
  }
}

/**
 * Handle combo timeout (progress bar fills up)
 */
function onComboTimeout() {
  exitComboMode();
}

/**
 * Handle combo button click — delegates to correct combo function
 */
async function handleComboClick() {
  if (comboType.value === 'lucky') {
    const success = await luckyCombo();
    if (success) {
      resetComboProgress();
      haptic("nudge");
    }
  } else {
    // Normal gift combo — enqueues another full playback behind whatever is on
    // screen (never interrupts). combo() handles its own GATE checks internally.
    await combo();
    resetComboProgress();
    haptic("nudge");
  }
}

// ========================================
// Gift Lifecycle
// ========================================

// Load gifts when drawer might be opened
onMounted(() => {
  ensureLoaded();
});

// Auto-select all recipients when drawer opens
watch(isOpen, (open) => {
  if (open && eligibleRecipients.value.length > 0) {
    selectAllRecipients();
  }
  if (!open) {
    if (isComboMode.value) {
      exitComboMode();
    }
    giftStore.clearLockedRecipient();
  }
});

// Open when a locked recipient is set (seat-drawer gift button flow)
watch(
  () => giftStore.lockedRecipientId,
  (newId, oldId) => {
    if (oldId === null && newId !== null) {
      isOpen.value = true;
    }
  }
);

// Close when seat drawer opens while gift drawer is open (mutual exclusion)
watch(
  () => seatsStore.activeSeat,
  (newSeat) => {
    if (newSeat !== null && isOpen.value) {
      isOpen.value = false;
      giftStore.clearLockedRecipient();
    }
  }
);

// Exit combo mode when user selects a different gift
watch(
  () => giftStore.selectedGift?.id,
  (newId, oldId) => {
    if (isComboMode.value && newId !== undefined && oldId !== undefined && newId !== oldId) {
      exitComboMode();
    }
  }
);

// Cleanup on unmount
onBeforeUnmount(() => {
  stopComboProgress();
});

/**
 * Handle gift selection
 */
function handleSelectGift(gift: Gift) {
  giftStore.selectGift(gift);
  haptic("nudge");
}

/**
 * Handle send button click
 */
async function handleSend() {
  const giftCategory = giftStore.selectedGift?.category;
  if (giftCategory === 'lucky') {
    await handleSendLucky();
    return;
  }
  const success = await send();
  if (success) {
    haptic("success");
    enterComboMode('normal');
  }
}

const roomStore = useRoomStore();

// Lucky Draw odds disclosure — shown before the first lucky gift per session
const oddsDisclosure = ref<InstanceType<typeof import('../odds.vue').default> | null>(null)
let pendingLuckySend = false

async function handleSendLucky(): Promise<void> {
  if (!oddsDisclosure.value) {
    await doLuckySend()
    return
  }
  pendingLuckySend = true
  const willShow = await oddsDisclosure.value.show()
  if (willShow) {
    // Close drawer so the odds modal isn't blocked behind it
    isOpen.value = false
  }
}

function onOddsAcknowledged(): void {
  if (!pendingLuckySend) return
  isOpen.value = true
  doLuckySend().then(() => { pendingLuckySend = false })
}

function onOddsDismissed(): void {
  pendingLuckySend = false
  isOpen.value = true
}

async function doLuckySend(): Promise<void> {
  const success = await send()
  if (success) {
    haptic('success')
    enterComboMode('lucky')
  }
}
</script>

<template>

  <RoomOdds
    ref="oddsDisclosure"
    @acknowledged="onOddsAcknowledged"
    @dismissed="onOddsDismissed"
  />

  <UDrawer
      v-model:open="isOpen" title="Send Gift" :overlay="false"
      :ui="{
        content: 'bg-transparent bg-neutral-900/80 ring-0',
        handle: 'bg-white!',
      }"
      description="Send gifts to speakers in the room"
  >
    <!-- Trigger Button -->
    <img :src="ASSETS.GIFT_DRAWER_ICON" alt="gifts" width="60px" class="cursor-pointer" >
    <template #content>
      <div class="p-2">
        <!-- Recipient Selector -->
        <RoomGiftRecipientSelector />
        <!-- Category Tabs with Gift Grid -->
        <RoomGiftCategoryTabs :categories="giftsByCategory">
          <template #content="{ item }">
            <RoomGiftGrid :gifts="item.gifts" :selected-gift-id="giftStore.selectedGift?.id" :selected-gift-readiness="readinessState" @select="handleSelectGift" />
          </template>
        </RoomGiftCategoryTabs>

        <!-- Send Controls -->
        <div class="flex items-center justify-between pt-1 border-t border-muted">
          <!-- Coin Balance -->
          <div class="flex items-center">
            <UButton
              trailing-icon="i-lucide-chevron-right"
              icon="i-lucide-coins"
              variant="subtle"
              color="warning"
              class="text-white font-bold shadow-lg"
              size="md"
              @click="async () => {
                isOpen = false;
                roomStore.isMinimized = true;
                await navigateTo(`/coins/request`);
              }"
            >
              {{ formatCurrency(authStore.user?.coins) }}
            </UButton>
          </div>

          <!-- Send / Combo area (animated transition) -->
          <Transition name="combo-morph" mode="out-in">
            <!-- COMBO MODE -->
            <div v-if="isComboMode" key="combo" class="combo-inline">
              <UButton size="sm" class="combo-btn" @pointerdown.prevent="handleComboClick">
                <span class="font-bold text-base">X{{ giftStore.comboCount }}</span>
                <span class="text-xs ml-1 opacity-80">Combo</span>
              </UButton>
              <!-- Progress bar -->
              <div class="combo-progress-track">
                <div class="combo-progress-fill" :style="{ width: (100 - comboProgress) + '%' }" />
              </div>
            </div>

            <!-- NORMAL SEND MODE -->
            <div v-else key="send">
              <!-- Total Cost Display -->
              <div v-if="totalCost > 0" class="text-sm">
                <span class="text-white">Total:</span>
                <span class="font-bold text-warning ml-1">
                  🪙 {{ totalCost.toLocaleString() }}
                </span>
              </div>

              <!-- Quantity Selector -->
              <UFieldGroup class="flex items-center">
                <USelect
:model-value="giftStore.selectedQuantity" :items="quantityOptions" size="sm"
                  class="w-20 rounded-full overflow-hidden" @update:model-value="
                    (val: number) => giftStore.setQuantity(val)
                  " />
                <!-- Send Button -->
                <UButton
:disabled="!canSend || isSending || !isSelectedGiftReady" :loading="isSending" size="sm" trailing-icon="i-lucide-send"
                  @click="handleSend">
                  Send
                </UButton>
              </UFieldGroup>
            </div>
          </Transition>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-center py-4">
          <UIcon name="i-lucide-loader-2" class="animate-spin size-6" />
        </div>
      </div>
    </template>
  </UDrawer>
</template>

<style scoped>
/* ========================================
 * Combo Morph Transition
 * ======================================== */
.combo-morph-enter-active,
.combo-morph-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.combo-morph-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.combo-morph-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* ========================================
 * Inline Combo Button
 * ======================================== */
.combo-inline {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
}

.combo-btn {
  border-radius: 9999px;
  min-width: 6rem;
  justify-content: center;
  animation: combo-pulse 0.3s ease-out;
}

@keyframes combo-pulse {
  0% {
    transform: scale(1.15);
  }

  100% {
    transform: scale(1);
  }
}

/* ========================================
 * Combo Progress Bar
 * ======================================== */
.combo-progress-track {
  height: 3px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  overflow: hidden;
}

.combo-progress-fill {
  height: 100%;
  background: var(--ui-primary);
  border-radius: 9999px;
  transition: width 0.1s linear;
}
</style>
