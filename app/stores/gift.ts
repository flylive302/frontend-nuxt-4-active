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
  // Dependencies
  // ========================================
  const authStore = useAuthStore();
  const roomStore = useRoomStore();

  // ========================================
  // Selection State
  // ========================================
  const selectedGift = ref<Gift | null>(null);
  const selectedRecipients = ref<number[]>([]);
  const selectedQuantity = ref<(typeof GIFT_QUANTITY_OPTIONS)[number]>(1);

  // ========================================
  // Playback State
  // ========================================
  const isPlaying = ref(false);
  const currentPlayback = ref<GiftPlaybackItem | null>(null);
  const playbackQueue = ref<GiftPlaybackItem[]>([]);
  const comboCount = ref(0);

  // ========================================
  // Computed: Recipients
  // ========================================

  /**
   * Eligible recipients = speakers (seated users) excluding self
   */
  const eligibleRecipients = computed(() => {
    const currentUserId = authStore.user?.id;
    return roomStore.seats
      .filter((seat) => seat.user !== null && seat.user.id !== currentUserId)
      .map((seat) => seat.user!);
  });

  // Prune stale recipients when eligible users change (e.g. speaker leaves seat)
  watch(eligibleRecipients, (eligible) => {
    const eligibleIds = new Set(eligible.map((r) => r.id));
    selectedRecipients.value = selectedRecipients.value.filter(
      (id) => eligibleIds.has(id),
    );
  });

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

  /**
   * Check if user can afford the current selection
   */
  const canAfford = computed(() => {
    const coins = Number(authStore.user?.coins ?? 0);
    return coins >= totalCost.value;
  });

  /**
   * Check if send is allowed
   */
  const canSend = computed(() => {
    return (
      selectedGift.value !== null &&
      selectedRecipients.value.length > 0 &&
      selectedQuantity.value > 0 &&
      canAfford.value
    );
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

  function selectAllRecipients() {
    selectedRecipients.value = eligibleRecipients.value.map((r) => r.id);
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
   * Add a gift to the playback queue
   */
  /**
   * Add a gift to the playback queue.
   * @param item - Gift playback item (without id and timestamp)
   */
  function enqueuePlayback(item: Omit<GiftPlaybackItem, 'id' | 'timestamp'>) {
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
   * Immediately replace current playback with a new item.
   * Clears the queue and resets combo. Used when the sender sends
   * a new gift while one is already playing — sender always sees
   * their latest gift immediately (no queuing behind other gifts).
   * @param item - Gift playback item (without id and timestamp)
   */
  function interruptAndPlay(item: Omit<GiftPlaybackItem, 'id' | 'timestamp'>) {
    playbackQueue.value = [];
    currentPlayback.value = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
    };
    isPlaying.value = true;
    comboCount.value = 1;
  }

  /**
   * Start playing the next item in the queue
   */
  function playNext() {
    if (playbackQueue.value.length === 0) {
      currentPlayback.value = null;
      isPlaying.value = false;
      isProcessingQueue.value = false;
      comboCount.value = 0;
      return;
    }

    currentPlayback.value = playbackQueue.value.shift()!;
    isPlaying.value = true;
    isProcessingQueue.value = false;
    comboCount.value = 1;
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
  }

  // ========================================
  // Combo Actions
  // ========================================

  /**
   * Increment combo count (called on combo button click)
   */
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

  /**
   * Restart the current playback (for combo on receiver side).
   * Instead of enqueuing a new item, this refreshes the current one.
   */
  function restartCurrentPlayback() {
    if (currentPlayback.value) {
      // Refresh timestamp to trigger reactivity for watchers
      currentPlayback.value = {
        ...currentPlayback.value,
        timestamp: Date.now(),
      };
      comboCount.value++;
    }
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Selection state
    selectedGift,
    selectedRecipients,
    selectedQuantity,

    // Playback state
    isPlaying,
    currentPlayback,
    playbackQueue,
    comboCount,

    // Computed
    eligibleRecipients,
    totalCost,
    canAfford,
    canSend,

    // Selection actions
    selectGift,
    clearSelection,
    toggleRecipient,
    selectAllRecipients,
    clearRecipients,
    removeRecipient,
    setQuantity,

    // Playback actions
    enqueuePlayback,
    interruptAndPlay,
    playNext,
    onPlaybackComplete,
    clearPlayback,

    // Combo actions
    incrementCombo,
    resetCombo,
    restartCurrentPlayback,
  };
});
