/**
 * Gift Store
 *
 * Centralized state management for gift selection, sending, and playback.
 * Side-effects (preload watch/debounce) have been extracted to useGiftPreload composable (SRP).
 */
import { defineStore } from 'pinia';
import type { Gift, GiftPlaybackItem } from '~/types/gift/gift';
import { MAX_PLAYBACK_QUEUE_SIZE } from '~/constants/gift';
import type { GIFT_QUANTITY_OPTIONS } from '~/constants/gift';

export const useGiftStore = defineStore('giftStore', () => {
  // ========================================
  // Selection State
  // ========================================
  const selectedGift = ref<Gift | null>(null);
  const selectedRecipients = ref<number[]>([]);
  const selectedQuantity = ref<(typeof GIFT_QUANTITY_OPTIONS)[number]>(1);
  const lockedRecipientId = ref<number | null>(null);

  // ========================================
  // Playback State
  // ========================================
  const isPlaying = ref(false);
  const currentPlayback = ref<GiftPlaybackItem | null>(null);
  const playbackQueue = ref<GiftPlaybackItem[]>([]);
  const comboCount = ref(0);

  // ========================================
  // Computed: Cost Calculation
  // ========================================

  /**
   * Total cost = gift price × recipients × quantity
   */
  const totalCost = computed(() => {
    if (!selectedGift.value) return 0;
    return selectedGift.value.price * selectedRecipients.value.length * selectedQuantity.value;
  });

  // ========================================
  // Selection Actions
  // ========================================

  /**
   * Select a gift for sending.
   * @param gift - Gift object to select
   */
  function selectGift(gift: Gift) {
    selectedGift.value = gift;
  }

  function clearSelection() {
    selectedGift.value = null;
    selectedRecipients.value = [];
    selectedQuantity.value = 1;
    lockedRecipientId.value = null;
  }

  function setLockedRecipient(id: number) {
    lockedRecipientId.value = id;
  }

  function clearLockedRecipient() {
    lockedRecipientId.value = null;
  }

  /**
   * Toggle recipient selection.
   * @param userId - User ID to toggle
   */
  function toggleRecipient(userId: number) {
    const index = selectedRecipients.value.indexOf(userId);
    if (index === -1) {
      selectedRecipients.value.push(userId);
    } else {
      selectedRecipients.value.splice(index, 1);
    }
  }

  function setSelectedRecipientIds(ids: number[]) {
    selectedRecipients.value = [...ids];
  }

  function clearRecipients() {
    selectedRecipients.value = [];
  }

  function removeRecipient(userId: number) {
    const index = selectedRecipients.value.indexOf(userId);
    if (index !== -1) {
      selectedRecipients.value.splice(index, 1);
    }
  }

  /**
   * Set gift quantity.
   * @param qty - Quantity to send (1, 10, 66, 188, 520, 1314)
   */
  function setQuantity(qty: number) {
    selectedQuantity.value = qty as (typeof GIFT_QUANTITY_OPTIONS)[number];
  }


  // ========================================
  // Playback Actions
  // ========================================

  /** Flag to prevent race condition when processing queue */
  const isProcessingQueue = ref(false);

  /**
   * batchIds already admitted to the queue. One send to N seats arrives as N
   * gift:received events sharing a batchId; we play the first and drop the rest
   * so a fan-out shows one animation, while separate combo presses (distinct
   * batchIds) each play. Insertion-ordered with FIFO eviction — fan-out
   * siblings arrive within ms so are never evicted before they're seen.
   */
  const seenBatchIds = new Set<string>();
  const SEEN_BATCH_IDS_CAP = 500;

  /**
   * Add a gift to the playback queue. Items carrying a batchId already seen are
   * coalesced (skipped) so a multi-recipient send plays exactly once.
   * @param item - Gift playback item (without id and timestamp)
   */
  function enqueuePlayback(item: Omit<GiftPlaybackItem, 'id' | 'timestamp'>) {
    // GATE: coalesce per-recipient fan-out of a single send into one playback.
    if (item.batchId) {
      if (seenBatchIds.has(item.batchId)) return;
      seenBatchIds.add(item.batchId);
      if (seenBatchIds.size > SEEN_BATCH_IDS_CAP) {
        seenBatchIds.delete(seenBatchIds.values().next().value!);
      }
    }

    if (playbackQueue.value.length >= MAX_PLAYBACK_QUEUE_SIZE) {
      // Drop the oldest if queue is full
      playbackQueue.value.shift();
    }

    const playbackItem: GiftPlaybackItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };

    playbackQueue.value.push(playbackItem);

    // Auto-start if not currently playing (with race condition protection)
    if (!isPlaying.value && !isProcessingQueue.value) {
      isProcessingQueue.value = true;
      playNext();
    }
  }

  /**
   * Start playing the next item in the queue
   */
  function playNext() {
    if (playbackQueue.value.length === 0) {
      currentPlayback.value = null;
      isPlaying.value = false;
      isProcessingQueue.value = false;
      return;
    }

    currentPlayback.value = playbackQueue.value.shift()!;
    isPlaying.value = true;
    isProcessingQueue.value = false;
  }

  /**
   * Called when current playback completes
   */
  function onPlaybackComplete() {
    playNext();
  }

  /**
   * Clear all playback state
   */
  function clearPlayback() {
    currentPlayback.value = null;
    playbackQueue.value = [];
    isPlaying.value = false;
    comboCount.value = 0;
    seenBatchIds.clear();
  }

  // ========================================
  // Combo Actions
  // ========================================

  /**
   * Increment combo count (called on combo button click).
   */
  function incrementCombo() {
    comboCount.value++;
  }

  /**
   * Reset combo state
   */
  function resetCombo() {
    comboCount.value = 0;
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Selection state
    selectedGift,
    selectedRecipients,
    selectedQuantity,
    lockedRecipientId,

    // Playback state
    isPlaying,
    currentPlayback,
    playbackQueue,
    comboCount,

    // Computed
    totalCost,

    // Selection actions
    selectGift,
    clearSelection,
    setLockedRecipient,
    clearLockedRecipient,
    toggleRecipient,
    setSelectedRecipientIds,
    clearRecipients,
    removeRecipient,
    setQuantity,

    // Playback actions
    enqueuePlayback,
    playNext,
    onPlaybackComplete,
    clearPlayback,

    // Combo actions
    incrementCombo,
    resetCombo,
  };
});
