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
import { isLuckyCategory } from '~/utils/gift';
import { useGiftData } from "~/composables/gift/useGiftData";
import { useGiftRecipientSync } from "~/composables/gift/useGiftRecipientSync";
import { useGiftSending } from "~/composables/gift/useGiftSending";
import { GIFT_QUANTITY_OPTIONS, COMBO_BUTTON_TIMEOUT_MS } from "~/constants/gift";
import { LUCKY_ANIMATION } from "~/constants/lucky-animation";
import {computed} from "vue";
import {computeLevelStatus, type LevelComputedStatus} from "~/utils/levels";

// Quantity options for select (mutable array for USelect compatibility)
const quantityOptions = [...GIFT_QUANTITY_OPTIONS];

const giftStore = useGiftStore();
const comboStore = useGiftComboStore();
const authStore = useAuthStore();
const seatsStore = useRoomSeatsStore();
const { eligibleRecipients, selectAllRecipients } = useGiftEligibility();
const { giftsByCategory, ensureLoaded, isLoading } = useGiftData();
const { totalCost, canSend, send, isSending, combo, luckyCombo, endLuckyCombo } = useGiftSending();

useGiftRecipientSync();

// Track drawer open state
const isOpen = ref(false);

// Active category tab (UTabs index string) — set programmatically when the
// drawer reopens after a lucky combo so the lucky tab is already showing.
const activeCategoryTab = ref<string>('0');

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
 * Exit combo mode — revert to normal send controls.
 *
 * Lucky combos run as a floating button over a CLOSED drawer, so ending one
 * reopens the drawer on the lucky tab, scrolled back to the played gift.
 */
function exitComboMode() {
  const wasLucky = isLuckyCategory(comboType.value);
  isComboMode.value = false;
  comboType.value = null;
  comboProgress.value = 0;
  stopComboProgress();
  if (wasLucky) {
    endLuckyCombo();
    reopenOnLuckyGift();
  } else {
    // Drop the normal combo context + streak badge once the combo window ends.
    comboStore.clearNormalContext();
    giftStore.resetCombo();
  }
}

/**
 * Whether the lucky combo float is on screen (drawer closed, big button up).
 * Guards the drawer-close watcher so closing FOR the float doesn't end the
 * combo it just started.
 */
const isLuckyFloatActive = computed(() => isComboMode.value && isLuckyCategory(comboType.value));

/**
 * Reopen the drawer after a lucky combo ends: lucky tab active, grid scrolled
 * to the gift that was played.
 */
async function reopenOnLuckyGift(): Promise<void> {
  isOpen.value = true;

  // Prefer the sent gift's own category so a gild-lucky combo reopens the
  // gild-lucky tab, not the plain lucky one; fall back to any lucky-family
  // tab if the sent gift's category isn't in scope here.
  const sentCategory = giftStore.selectedGift?.category;
  let luckyTabIndex = sentCategory
    ? giftsByCategory.value.findIndex((group) => group.category === sentCategory)
    : -1;
  if (luckyTabIndex === -1) {
    luckyTabIndex = giftsByCategory.value.findIndex((group) => isLuckyCategory(group.category));
  }
  if (luckyTabIndex !== -1) {
    activeCategoryTab.value = String(luckyTabIndex);
  }

  // Two ticks: one for the drawer content to mount, one for the tab switch to
  // render its grid — then the played gift can be scrolled into view.
  await nextTick();
  await nextTick();
  const giftId = giftStore.selectedGift?.id;
  if (giftId !== undefined) {
    document
      .querySelector(`[data-gift-id="${giftId}"]`)
      ?.scrollIntoView({ block: 'nearest' });
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
  if (isLuckyCategory(comboType.value)) {
    const success = await luckyCombo();
    if (success) {
      resetComboProgress();
    }
  } else {
    // Normal gift combo — enqueues another full playback behind whatever is on
    // screen (never interrupts). combo() handles its own GATE checks internally.
    await combo();
    resetComboProgress();
  }
}

// ========================================
// Gift Lifecycle
// ========================================

// Load gifts when drawer might be opened
onMounted(() => {
  ensureLoaded();
});

// Room-covered signal (room-battery-perf/03): pause seat/frame animation
// behind the drawer while it's open. Auto-released on unmount.
const { cover, uncover } = useRoomCovered();

// Auto-select all recipients when drawer opens
watch(isOpen, (open) => {
  if (open) {
    cover();
  } else {
    uncover();
  }
  if (open && eligibleRecipients.value.length > 0) {
    selectAllRecipients();
  }
  if (!open) {
    // The lucky combo float closes the drawer ON PURPOSE — the combo keeps
    // running as the floating button; only a normal combo ends on close.
    if (isComboMode.value && !isLuckyFloatActive.value) {
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

// Close when the seat drawer opens while the gift drawer is open (mutual
// exclusion). Covers both of the seat drawer's modes — seat tap and avatar tap
// — since either one replaces the gift drawer's target.
watch(
  () => seatsStore.activeSeat !== null || seatsStore.profileUserId !== null,
  (seatDrawerOpen) => {
    if (seatDrawerOpen && isOpen.value) {
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

const bootstrapStore = useBootstrapStore();

const userXp = computed(() => authStore.user?.wealth_xp)

const sortedConfigs = computed(() => bootstrapStore.sortedWealthLevels)

const levelStatus = computed<LevelComputedStatus>(() =>
    computeLevelStatus(userXp.value, sortedConfigs.value)
)
const progressValue = computed(() => levelStatus.value.progress_percentage)

const currentLevel = computed(() => levelStatus.value.current_level)

const nextLevel = computed(() =>
    levelStatus.value.next_level?.level ?? currentLevel.value + 1
)

const currentXP = computed(() =>
    levelStatus.value.current_xp.toLocaleString()
)

const xpRemaining = computed(() =>
    levelStatus.value.xp_remaining.toLocaleString()
)
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
  const giftCategory = giftStore.selectedGift?.category;
  if (isLuckyCategory(giftCategory)) {
    await handleSendLucky();
    return;
  }
  const success = await send();
  if (success) {
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
    enterComboMode('lucky')
    // Lucky combos take over as the floating center button — close the drawer
    // so the cashback + fly animations are unobstructed. Reopens on combo end.
    isOpen.value = false
  }
}
</script>

<template>

  <RoomOdds
    ref="oddsDisclosure"
    @acknowledged="onOddsAcknowledged"
    @dismissed="onOddsDismissed"
  />

  <!-- Floating lucky combo button: replaces the drawer while a lucky combo
       runs so the cashback/fly animations play unobstructed. -->
  <Teleport to="body">
    <Transition name="lucky-combo-float">
      <!-- bottom is inline (not CSS v-bind): teleported nodes sit outside this
           component's subtree, so scoped v-bind custom properties can't reach them -->
      <div
        v-if="isLuckyFloatActive"
        class="lucky-combo-float"
        :style="{ bottom: `${LUCKY_ANIMATION.comboFloatBottomPct}vh` }"
      >
        <button type="button" class="lucky-combo-float__btn" @pointerdown.prevent="handleComboClick">
          <span class="lucky-combo-float__count">X{{ giftStore.comboCount }}</span>
          <span class="lucky-combo-float__label">Combo</span>
        </button>
        <div class="lucky-combo-float__track">
          <div class="lucky-combo-float__fill" :style="{ width: (100 - comboProgress) + '%' }" />
        </div>
      </div>
    </Transition>
  </Teleport>

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
        <div class="flex justify-between items-center">
          <p class="text-xs font-bold">LvL: {{ currentLevel }} XP: {{ currentXP }}</p>
          <p class="text-xs font-bold">XP: {{ xpRemaining }} for LvL: {{ nextLevel }}</p>
        </div>
        <UProgress :model-value="progressValue" color="secondary" class="mb-2" />
        <!-- Recipient Selector -->
        <RoomGiftRecipientSelector />

        <!-- Category Tabs with Gift Grid -->
        <RoomGiftCategoryTabs v-model:active="activeCategoryTab" :categories="giftsByCategory">
          <template #content="{ item }">
            <RoomGiftGrid :gifts="item.gifts" :selected-gift-id="giftStore.selectedGift?.id" @select="handleSelectGift" />
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
:disabled="!canSend || isSending" :loading="isSending" size="sm" trailing-icon="i-lucide-send"
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
 * Floating Lucky Combo Button
 * ======================================== */
.lucky-combo-float {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
}

.lucky-combo-float__btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 9999px;
  border: 3px solid rgba(253, 224, 71, 0.85);
  background: radial-gradient(circle at 30% 25%, #a855f7, #6d28d9 65%, #4c1d95);
  color: #fff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45), 0 0 18px rgba(168, 85, 247, 0.5);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  animation: combo-pulse 0.3s ease-out;
}

.lucky-combo-float__btn:active {
  transform: scale(0.94);
}

.lucky-combo-float__count {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(180deg, #fef08a, #f59e0b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.5));
}

.lucky-combo-float__label {
  font-size: 0.7rem;
  font-weight: 700;
  opacity: 0.85;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.lucky-combo-float__track {
  width: 72px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  overflow: hidden;
}

.lucky-combo-float__fill {
  height: 100%;
  background: linear-gradient(90deg, #fde047, #f59e0b);
  border-radius: 9999px;
  transition: width 0.1s linear;
}

.lucky-combo-float-enter-active,
.lucky-combo-float-leave-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out;
}

.lucky-combo-float-enter-from,
.lucky-combo-float-leave-to {
  opacity: 0;
  transform: translateX(-50%) scale(0.6);
}

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
