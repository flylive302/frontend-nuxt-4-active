/**
 * Gift Store
 *
 * Centralized state management for gift selection, sending, and playback.
 * Side-effects (preload watch/debounce) have been extracted to useGiftPreload composable (SRP).
 *
 * Playback lanes (gift-backlog-and-lag 06): heavy/critical gifts (see
 * `laneFor()` below) play full-screen, one at a time, in the CENTER lane.
 * Everything else fills up to SIDE_LANES concurrent small SIDE lanes so
 * interleaved senders don't wait behind a single FIFO.
 * `currentPlayback`/`playbackQueue` stay aliases of the center lane so
 * existing readers keep working unchanged.
 */
import { defineStore } from 'pinia';
import { useFxPreferencesStore } from '~/stores/fxPreferences';
import type { Gift, GiftPlaybackItem } from '~/types/gift/gift';
import {
  BURST_SHED_QUEUE_DEPTH,
  GIFT_PLAYBACK_MAX_AGE_MS,
  MAX_PLAYBACK_QUEUE_SIZE,
  MAX_PLAYBACK_REPEATS,
  MERGE_LOOKBACK,
  SIDE_LANES,
} from '~/constants/gift';
import { isAway } from '~/services/motionPauseOrchestrator';
import type { GIFT_QUANTITY_OPTIONS } from '~/constants/gift';

type Lane = 'center' | 'side';

/**
 * gift-backlog-and-lag 06 — which lane a gift plays in. NOT simply
 * `is_critical`: in the prod catalog no gift is flagged `is_critical`, so
 * that alone would send everything to the 64px side lanes and nothing would
 * ever play full screen. The catalog splits cleanly on `asset_type` instead —
 * lucky gifts are `asset_type: 'image'` (cheap, spammed), everything else
 * that deserves full-screen attention (`video`, `vap`) is heavier and rarer.
 * Center = `is_critical` OR `video`/`vap`; side = everything else
 * (`image`/`svga`). Pure function — no store/queue reads — so it's safe to
 * call from `enqueuePlayback` on every item.
 */
function laneFor(gift: Gift): Lane {
  return gift.is_critical || gift.asset_type === 'video' || gift.asset_type === 'vap' ? 'center' : 'side';
}

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

  /** Center lane: full-screen, one item at a time. */
  const isPlaying = ref(false);
  const currentCenter = ref<GiftPlaybackItem | null>(null);
  const centerQueue = ref<GiftPlaybackItem[]>([]);

  /** Side lanes: up to SIDE_LANES concurrent small players. */
  const currentSides = ref<(GiftPlaybackItem | null)[]>(Array.from({ length: SIDE_LANES }, () => null));
  const sideQueue = ref<GiftPlaybackItem[]>([]);

  /** Back-compat aliases — existing readers (isSender, lucky-fly, stall-monitor) untouched. */
  const currentPlayback = computed(() => currentCenter.value);
  const playbackQueue = computed(() => centerQueue.value);

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

  /** Flag to prevent race condition when processing the center queue */
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

  function laneQueue(lane: Lane) {
    return lane === 'center' ? centerQueue.value : sideQueue.value;
  }

  /**
   * gift-backlog-and-lag 06 — search the newest MERGE_LOOKBACK items of a
   * lane's queue (tail-backward) for a matching (gift, sender) entry to bump
   * repeats onto, instead of only checking the last item. Interleaved
   * senders (A(X) A(Y) B(Y) A(X)) now merge the two A(X) plays even though
   * they aren't adjacent.
   */
  function findMergeCandidate(lane: Lane, giftId: number, senderId: number): GiftPlaybackItem | undefined {
    const queue = laneQueue(lane);
    const start = queue.length - 1;
    const end = Math.max(0, queue.length - MERGE_LOOKBACK);
    for (let i = start; i >= end; i--) {
      const candidate = queue[i];
      if (candidate && candidate.gift.id === giftId && candidate.senderId === senderId) {
        return candidate;
      }
    }
    return undefined;
  }

  /** The item currently playing in a lane — center's single slot or a matching side slot. */
  function findPlayingMatch(lane: Lane, giftId: number, senderId: number): GiftPlaybackItem | undefined {
    if (lane === 'center') {
      const current = currentCenter.value;
      return current && current.gift.id === giftId && current.senderId === senderId ? current : undefined;
    }
    return currentSides.value.find(
      (item): item is GiftPlaybackItem => !!item && item.gift.id === giftId && item.senderId === senderId,
    );
  }

  /**
   * Add a gift to the playback queue. Items carrying a batchId already seen are
   * coalesced (skipped) so a multi-recipient send plays exactly once.
   * @param item - Gift playback item (without id, timestamp and lane)
   */
  function enqueuePlayback(item: Omit<GiftPlaybackItem, 'id' | 'timestamp' | 'lane'>) {
    // GATE: per-device FX mute preferences. This is the single choke point every
    // producer funnels through (gift:received, own sends, combos, entry
    // animations), so gating here — a pure state read, not a cross-store action
    // call — keeps future enqueue sites from having to remember the check.
    // Balances/XP/transactions are booked by callers BEFORE enqueueing, so a
    // dropped item only skips the visual.
    const fxPrefs = useFxPreferencesStore();
    if (item.isEntryAnimation ? fxPrefs.muteEntryAnimations : fxPrefs.muteGiftAnimations) return;

    // GATE (gift-backlog-and-lag 01): nobody is watching — app backgrounded or
    // tab hidden. Balances/XP/chat are already booked by the caller; queuing
    // the visual would only replay it as a pile when the viewer returns.
    if (isAway()) return;

    // GATE: coalesce per-recipient fan-out of a single send into one playback.
    if (item.batchId) {
      if (seenBatchIds.has(item.batchId)) return;
      seenBatchIds.add(item.batchId);
      if (seenBatchIds.size > SEEN_BATCH_IDS_CAP) {
        seenBatchIds.delete(seenBatchIds.values().next().value!);
      }
    }

    // gift-backlog-and-lag 06: heavy/critical gifts play full-screen in the
    // center lane, one at a time; everything else fills the side lanes. See
    // laneFor() for why this isn't just `is_critical`.
    const lane: Lane = laneFor(item.gift);

    // Coalesce a run of identical (gift, sender) items anywhere in this
    // lane's queue (up to MERGE_LOOKBACK back), or onto the item currently
    // playing in this lane — a 77-combo burst, even interleaved with other
    // senders, becomes one slot playing ×N instead of N separate plays.
    // Runs BEFORE the burst-shed gate: a coalesced repeat never grows the
    // queue, so shedding it would silently eat a paid combo press for zero
    // backlog win.
    const queuedMatch = findMergeCandidate(lane, item.gift.id, item.senderId);
    if (queuedMatch && (queuedMatch.repeats ?? 1) < MAX_PLAYBACK_REPEATS) {
      queuedMatch.repeats = (queuedMatch.repeats ?? 1) + 1;
      return;
    }
    const playingMatch = findPlayingMatch(lane, item.gift.id, item.senderId);
    if (playingMatch && (playingMatch.repeats ?? 1) < MAX_PLAYBACK_REPEATS) {
      playingMatch.repeats = (playingMatch.repeats ?? 1) + 1;
      return;
    }

    const queue = laneQueue(lane);

    // GATE: burst-mode load shedding (msab-load-stability 11). Once a lane's
    // backlog reaches BURST_SHED_QUEUE_DEPTH, stop admitting non-critical
    // gifts — the caller already booked balance/XP before enqueueing, so a
    // shed item only skips its animation. This keeps the queue (and the
    // video/svga decode work behind it) bounded well under the hard
    // MAX_PLAYBACK_QUEUE_SIZE cap during a heavy multi-sender burst, instead
    // of freezing the main thread trying to play everything that lands.
    // Critical gifts (center lane) are never shed.
    if (queue.length >= BURST_SHED_QUEUE_DEPTH && !item.gift.is_critical) {
      return;
    }

    if (queue.length >= MAX_PLAYBACK_QUEUE_SIZE) {
      // Drop the oldest if queue is full
      queue.shift();
    }

    const playbackItem: GiftPlaybackItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: Date.now(),
      lane,
    };

    queue.push(playbackItem);

    if (lane === 'center') {
      // Auto-start if not currently playing (with race condition protection)
      if (!isPlaying.value && !isProcessingQueue.value) {
        isProcessingQueue.value = true;
        playNextCenter();
      }
    } else {
      fillSideLanes();
    }
  }

  /**
   * Start playing the next item in the center queue.
   */
  function playNextCenter() {
    // gift-backlog-and-lag 01: skip items that waited past their max age —
    // the viewer has moved on; only a fresh item is worth a full-screen play.
    const cutoff = Date.now() - GIFT_PLAYBACK_MAX_AGE_MS;
    while (centerQueue.value.length > 0 && centerQueue.value[0]!.timestamp < cutoff) {
      centerQueue.value.shift();
    }

    if (centerQueue.value.length === 0) {
      currentCenter.value = null;
      isPlaying.value = false;
      isProcessingQueue.value = false;
      return;
    }

    currentCenter.value = centerQueue.value.shift()!;
    isPlaying.value = true;
    isProcessingQueue.value = false;
  }

  /** @deprecated Use playNextCenter — kept as an alias so existing readers keep working. */
  const playNext = playNextCenter;

  /**
   * gift-backlog-and-lag 06 — fill any empty side lane slots from the side
   * queue. A lane pulls its next item as soon as it frees up; up to
   * SIDE_LANES items play concurrently, the rest wait.
   */
  function fillSideLanes() {
    const cutoff = Date.now() - GIFT_PLAYBACK_MAX_AGE_MS;
    while (sideQueue.value.length > 0 && sideQueue.value[0]!.timestamp < cutoff) {
      sideQueue.value.shift();
    }

    for (let i = 0; i < SIDE_LANES; i++) {
      if (currentSides.value[i]) continue;

      // Drop stale items pulled to the front mid-loop too.
      while (sideQueue.value.length > 0 && sideQueue.value[0]!.timestamp < cutoff) {
        sideQueue.value.shift();
      }
      if (sideQueue.value.length === 0) break;

      const next = sideQueue.value.shift()!;
      // Decide the render mode ONCE, on assignment — never recomputed while
      // playing, so a lane mid-SVGA never unmounts when the queue grows.
      next.playSvga = next.gift.asset_type === 'svga' && sideQueue.value.length < SIDE_LANES;
      currentSides.value[i] = next;
    }
  }

  /**
   * gift-backlog-and-lag 01: drop everything still waiting (the viewer went
   * away or just came back), in both lanes. Items already on screen are left
   * to the motion-pause registry, which already pauses/resumes the player
   * itself.
   */
  function dropQueuedPlayback() {
    centerQueue.value = [];
    sideQueue.value = [];
  }

  /**
   * Called when a center or side lane's active item completes.
   * A coalesced item with repeats left replays under a fresh id (the player is
   * keyed by id, so this remounts and plays again — cheap now that resolved
   * URLs hit the L1 blob cache) before the lane advances.
   *
   * @param lane - defaults to 'center' so the existing single-lane call site
   *   (`useGiftPlayback.handleComplete()`) keeps working unchanged.
   * @param sideIndex - required for lane === 'side'; which of the SIDE_LANES
   *   slots completed.
   */
  function onPlaybackComplete(lane: Lane = 'center', sideIndex?: number) {
    if (lane === 'center') {
      const current = currentCenter.value;
      if (current && (current.repeats ?? 1) > 1) {
        currentCenter.value = {
          ...current,
          repeats: (current.repeats ?? 1) - 1,
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        };
        return;
      }
      playNextCenter();
      return;
    }

    if (sideIndex === undefined || sideIndex < 0 || sideIndex >= SIDE_LANES) return;
    const current = currentSides.value[sideIndex];
    if (current && (current.repeats ?? 1) > 1) {
      currentSides.value[sideIndex] = {
        ...current,
        repeats: (current.repeats ?? 1) - 1,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        playSvga: current.playSvga,
      };
      return;
    }
    currentSides.value[sideIndex] = null;
    fillSideLanes();
  }

  /**
   * Clear all playback state
   */
  function clearPlayback() {
    currentCenter.value = null;
    centerQueue.value = [];
    currentSides.value = Array.from({ length: SIDE_LANES }, () => null);
    sideQueue.value = [];
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
    currentCenter,
    centerQueue,
    currentSides,
    sideQueue,
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
    playNextCenter,
    fillSideLanes,
    onPlaybackComplete,
    clearPlayback,
    dropQueuedPlayback,

    // Combo actions
    incrementCombo,
    resetCombo,
  };
});
