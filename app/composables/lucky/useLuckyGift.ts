/**
 * Lucky Gift Composable
 *
 * Owns the state-driven Lucky Gift visuals (lucky-animation-ux epic):
 *   - Center cashback: ONE persistent animation whose state is overwritten by
 *     wins — never a queue. `lucky:result` (sender-private) drives it.
 *   - Sender activity bands: one room-visible band per active sender, fed by
 *     `gift:received` taps (via recordLuckyGiftActivity) and `lucky:room-result`
 *     wins. Reused and updated in place — never one DOM node per event.
 *   - No-draw notice floaters (unchanged small text pills).
 *   - In-room chat bubbles for sub-slide wins (5X/10X…); slide-bound big wins
 *     keep announcing via slide.events.ts untouched.
 *
 * Every timing lives in LUCKY_ANIMATION (constants/lucky-animation.ts).
 * All timers are tracked and cleared in cleanupLuckyEventHandlers — rapid
 * event bursts collapse into current state, never a replayed backlog.
 *
 * State is owned by useLuckySessionStore.
 */
import type { AudioSocket } from '~/composables/room/useAudioSocket';
import type {
  FloatingMultiplier,
  LuckyDrawResult,
  LuckyNoDrawPayload,
  LuckyNoDrawReason,
  LuckyRoomResultPayload,
  LuckySenderBand,
} from '~/types/lucky';
import type { ChatMessageEvent } from '~/types/room/audio';
import type { SvgaPlugin } from '~/types/asset/svga';
import { LUCKY_ANIMATION } from '~/constants/lucky-animation';
import { CHAT_MESSAGE_TYPE_LUCKY_WIN } from '~/constants/room';
import { resolveCashbackTier, resolveCashbackSvgaUrl } from '~/utils/lucky-cashback';
import { createLogger } from '~/utils/logger';

const logger = createLogger('[LuckyGift]');

// ============================================
// Constants
// ============================================

/** Time (ms) a no-draw notice floater stays visible — longer, to be read */
const NOTICE_DURATION = 3500;

/** Max concurrent notice floaters */
const MAX_FLOATERS = 5;

/** Sender-facing copy per no-draw reason (honest, non-alarming) */
const NO_DRAW_COPY: Record<LuckyNoDrawReason, string> = {
  capped: 'pool capped for today',
  user_capped: 'your daily win limit reached',
  disabled: 'lucky draws unavailable',
  no_eligible_tier: 'lucky draws unavailable',
};

/** Lucky socket event names (used for cleanup) */
const LUCKY_EVENTS = ['lucky:result', 'lucky:no-draw', 'lucky:room-result'] as const;

// ============================================
// Module-Level State
// ============================================

// Cached store reference — initialised in setupLuckyEventHandlers (setup context),
// then reused by socket callbacks that run outside Vue setup.
let _store: ReturnType<typeof useLuckySessionStore> | null = null;

let floaterIdCounter = 0;
let cashbackRevision = 0;

/**
 * Reasons already surfaced this room session — throttles no-draw notices to one
 * per reason so spamming gifts can't flood the screen. Cleared on room leave.
 */
const shownNoticeReasons = new Set<LuckyNoDrawReason>();

// ── Tracked timers ──────────────────────────
// Every setTimeout handle is kept here so cleanup can cancel the lot — no
// orphaned timers fire after room leave, and bursts reset instead of stacking.

/** Center cashback visible→fade timer + fade→clear timer */
let cashbackTimer: ReturnType<typeof setTimeout> | null = null;

/** Per-sender band inactivity/fade timer (one live timer per band) */
const bandTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** Notice floater removal timers */
const floaterTimers = new Set<ReturnType<typeof setTimeout>>();

function clearCashbackTimer(): void {
  if (cashbackTimer !== null) {
    clearTimeout(cashbackTimer);
    cashbackTimer = null;
  }
}

function clearBandTimer(senderId: number): void {
  const handle = bandTimers.get(senderId);
  if (handle !== undefined) {
    clearTimeout(handle);
    bandTimers.delete(senderId);
  }
}

// ============================================
// Notice Floaters (no-draw hints)
// ============================================

function pushFloater(entry: FloatingMultiplier, duration: number): void {
  const store = _store;
  if (!store) return;

  if (store.floatingMultipliers.length >= MAX_FLOATERS) {
    const first = store.floatingMultipliers[0];
    if (first) store.removeFloater(first.id);
  }

  store.addFloater(entry);

  const handle = setTimeout(() => {
    floaterTimers.delete(handle);
    store.removeFloater(entry.id);
  }, duration);
  floaterTimers.add(handle);
}

function addNoticeFloater(text: string): void {
  pushFloater(
    { id: ++floaterIdCounter, kind: 'notice', text, colorClass: 'lucky-float--notice' },
    NOTICE_DURATION,
  );
}

// ============================================
// Center Cashback (single state-driven visual)
// ============================================

/**
 * Overwrite-or-renew the ONE center cashback from a win.
 *
 * Tier precedence (HITL 2026-08-09):
 *   - no visual, fading, same tier, or HIGHER tier → overwrite immediately
 *     (tier upgrades interrupt the fade; same tier refreshes the number).
 *   - LOWER tier while a higher one is fully visible → renew the timer only;
 *     the higher visual stays (the band carries the exact per-win record).
 *
 * The shown number is always ONE win's real amount — never a sum. Sums live
 * on the sender band only.
 */
function showCenterCashback(multiplier: number, coinsWon: number): void {
  const store = _store;
  if (!store) return;

  const tier = resolveCashbackTier(multiplier);
  if (tier === null) return; // ×0 bust — a losing draw shows nothing

  const current = store.centerCashback;
  const overwrite = current === null || current.phase === 'fading' || tier >= current.tier;

  if (overwrite) {
    store.setCenterCashback({
      tier,
      multiplier,
      coinsWon,
      phase: 'visible',
      revision: ++cashbackRevision,
    });
  } else {
    // Lower tier during a fully-visible higher one: keep the visual, renew.
    store.setCenterCashbackPhase('visible');
  }

  clearCashbackTimer();
  cashbackTimer = setTimeout(startCashbackFade, LUCKY_ANIMATION.cashbackVisibleDuration);
}

function startCashbackFade(): void {
  const store = _store;
  if (!store || !store.centerCashback) return;

  store.setCenterCashbackPhase('fading');
  clearCashbackTimer();
  cashbackTimer = setTimeout(() => {
    cashbackTimer = null;
    store.setCenterCashback(null);
  }, LUCKY_ANIMATION.cashbackFadeDuration);
}

// ============================================
// Sender Activity Bands
// ============================================

/** Lowest free slot index, or null when all bandMaxVisible slots are taken */
function findFreeSlot(): number | null {
  const store = _store;
  if (!store) return null;

  const used = new Set<number>();
  for (const band of store.senderBands.values()) {
    if (band.slot !== null) used.add(band.slot);
  }
  for (let slot = 0; slot < LUCKY_ANIMATION.bandMaxVisible; slot++) {
    if (!used.has(slot)) return slot;
  }
  return null;
}

/** Restart a band's inactivity countdown (any activity revives + renews it) */
function armBandTimer(senderId: number): void {
  clearBandTimer(senderId);
  bandTimers.set(
    senderId,
    setTimeout(() => startBandFade(senderId), LUCKY_ANIMATION.bandInactivityTimeout),
  );
}

function startBandFade(senderId: number): void {
  const store = _store;
  if (!store) return;

  store.patchBand(senderId, { phase: 'fading' });
  clearBandTimer(senderId);
  bandTimers.set(
    senderId,
    setTimeout(() => expireBand(senderId), LUCKY_ANIMATION.bandFadeDuration),
  );
}

/** Remove a fully-faded band, free its slot, and seat the oldest waiting band */
function expireBand(senderId: number): void {
  const store = _store;
  if (!store) return;

  clearBandTimer(senderId);
  const freedSlot = store.senderBands.get(senderId)?.slot ?? null;
  store.removeBand(senderId);

  if (freedSlot === null) return;

  // Oldest still-active sender waiting without a slot inherits the freed one.
  let waiting: LuckySenderBand | null = null;
  for (const band of store.senderBands.values()) {
    if (band.slot === null && (waiting === null || band.lastActivityAt < waiting.lastActivityAt)) {
      waiting = band;
    }
  }
  if (waiting) store.patchBand(waiting.senderId, { slot: freedSlot });
}

/**
 * Record lucky gift TAP activity for a sender (from `gift:received` for
 * others, and the local send path for the sender's own client). Creates or
 * updates that sender's single band — never a new element per tap.
 */
export function recordLuckyGiftActivity(activity: {
  senderId: number;
  senderName: string;
  senderAvatar: string | null;
  giftName: string;
  recipientName: string | null;
  recipientCount: number;
  quantity: number;
}): void {
  const store = _store;
  if (!store) return;

  const existing = store.senderBands.get(activity.senderId);

  if (existing) {
    store.patchBand(activity.senderId, {
      giftName: activity.giftName,
      recipientName: activity.recipientCount > 1 ? null : activity.recipientName,
      recipientCount: activity.recipientCount,
      quantity: existing.quantity + activity.quantity,
      phase: 'visible',
      lastActivityAt: Date.now(),
    });
  } else {
    store.upsertBand({
      senderId: activity.senderId,
      senderName: activity.senderName,
      senderAvatar: activity.senderAvatar,
      giftName: activity.giftName,
      recipientName: activity.recipientCount > 1 ? null : activity.recipientName,
      recipientCount: activity.recipientCount,
      quantity: activity.quantity,
      coinsWon: 0,
      slot: findFreeSlot(),
      phase: 'visible',
      lastActivityAt: Date.now(),
    });
  }

  armBandTimer(activity.senderId);
}

/**
 * Convenience for tap call sites that hold recipient IDS, not names (the
 * `gift:received` handler and the sender's own send path): resolves the
 * single-recipient display name from the participants store, then records.
 */
export function recordLuckyGiftTap(params: {
  senderId: number;
  senderName: string;
  senderAvatar: string | null;
  giftName: string;
  recipientIds: number[];
  quantity: number;
}): void {
  const recipientName = params.recipientIds.length === 1
    ? resolveParticipantName(params.recipientIds[0]!)
    : null;

  recordLuckyGiftActivity({
    senderId: params.senderId,
    senderName: params.senderName,
    senderAvatar: params.senderAvatar,
    giftName: params.giftName,
    recipientName,
    recipientCount: params.recipientIds.length,
    quantity: params.quantity,
  });
}

/** Accumulate a WIN onto the sender's band (wins only — losses never appear) */
function recordLuckyWin(data: LuckyRoomResultPayload): void {
  const store = _store;
  if (!store) return;

  const existing = store.senderBands.get(data.sender_id);
  if (existing) {
    store.patchBand(data.sender_id, {
      coinsWon: existing.coinsWon + data.coins_won,
      phase: 'visible',
      lastActivityAt: Date.now(),
    });
    armBandTimer(data.sender_id);
  }
  // No band → the tap that produced this win predates us joining the room, or
  // its band already expired; the chat bubble still records the win.
}

// ============================================
// Chat: in-room small-win bubble
// ============================================

/**
 * In-room win bubble for every winning draw WITHOUT a bound slide (5X/10X…).
 * Slide-bound wins (100X+ style) keep announcing via slide.events.ts —
 * `has_slide` prevents the double bubble. `lucky:room-result` is room-scoped
 * server-side, so visibility is already "this room only".
 */
function synthesizeSmallWinChatMessage(data: LuckyRoomResultPayload, senderName: string): void {
  const audioStore = useRoomAudioStore();
  const message: ChatMessageEvent = {
    id: `lucky-win-${data.sender_id}-${Date.now()}`,
    userId: data.sender_id,
    userName: senderName,
    content: `${senderName} got a ${formatWinMultiplier(data.multiplier)}x win playing ${data.gift_name} — won ${data.coins_won.toLocaleString('en-US')} coins`,
    type: CHAT_MESSAGE_TYPE_LUCKY_WIN,
    timestamp: Date.now(),
    luckyWin: { multiplier: data.multiplier, coinsWon: data.coins_won },
  };
  audioStore.addMessage(message);
}

/** 20 not 20.00, but 0.5 stays 0.5 — mirrors backend formatMultiplier */
function formatWinMultiplier(multiplier: number): string {
  return multiplier.toFixed(2).replace(/\.?0+$/, '');
}

// ============================================
// Socket Handlers
// ============================================

/** Sender-private result → the sender's own instant center cashback */
function handleLuckyResult(data: LuckyDrawResult): void {
  if (!(data.multiplier > 0)) return;
  showCenterCashback(data.multiplier, data.coins_won);
}

/** Display name from the live participants map — null-safe outside Nuxt/room */
function resolveParticipantName(userId: number): string | null {
  try {
    return useRoomParticipantsStore().participants.get(userId)?.name ?? null;
  } catch {
    return null;
  }
}

/** Room-scoped win → band accumulation + small-win chat bubble (all clients) */
function handleLuckyRoomResult(data: LuckyRoomResultPayload): void {
  if (!(data.multiplier > 0)) return;

  const senderName = resolveParticipantName(data.sender_id) ?? 'A player';

  recordLuckyWin(data);

  if (!data.has_slide) {
    synthesizeSmallWinChatMessage(data, senderName);
  }
}

/**
 * Typed "no draw" signal (Epic B ticket 08): the draw was skipped for a
 * user-visible reason. One notice per reason per room session.
 */
function handleLuckyNoDraw(data: LuckyNoDrawPayload): void {
  if (shownNoticeReasons.has(data.reason)) return;
  shownNoticeReasons.add(data.reason);

  addNoticeFloater(NO_DRAW_COPY[data.reason] ?? NO_DRAW_COPY.disabled);
  logger.debug('lucky:no-draw rendered', data);
}

// ============================================
// SVGA Pre-warm
// ============================================

/**
 * Load the common cashback tier .svga files in the background on room entry,
 * so a burst's FIRST win renders instantly instead of waiting its turn in the
 * app-wide serialized SVGA loader (the root cause of the old delayed-backlog
 * behavior). Fire-and-forget; failures just fall back to on-demand loading.
 */
function prewarmCashbackSvgas(): void {
  let svga: SvgaPlugin | undefined;
  try {
    svga = useNuxtApp().$svga as SvgaPlugin | undefined;
  } catch {
    return; // no Nuxt app context (unit tests) — prewarm is best-effort only
  }
  if (!svga) return;

  for (const tier of LUCKY_ANIMATION.cashbackPrewarmTiers) {
    const url = resolveCashbackSvgaUrl(tier);
    if (url && !svga.isCached(url)) {
      svga.fetchAnimation(url).catch(() => {
        logger.debug('cashback svga pre-warm failed', { tier });
      });
    }
  }
}

// ============================================
// Public API: Setup / Cleanup
// ============================================

/**
 * Register lucky socket listeners.
 * Called from useRoomEventHandlers.setupRoomEventHandlers().
 */
export function setupLuckyEventHandlers(socket: AudioSocket): void {
  if (!_store) _store = useLuckySessionStore();
  socket.on('lucky:result', handleLuckyResult);
  socket.on('lucky:no-draw', handleLuckyNoDraw);
  socket.on('lucky:room-result', handleLuckyRoomResult);
  prewarmCashbackSvgas();
}

/**
 * Remove lucky socket listeners and cancel every tracked timer, so nothing
 * fires after room leave and no visual state leaks into the next room.
 * Called from useRoomEventHandlers.cleanupRoomEventHandlers().
 */
export function cleanupLuckyEventHandlers(socket: AudioSocket): void {
  for (const event of LUCKY_EVENTS) {
    socket.off(event);
  }
  shownNoticeReasons.clear();

  clearCashbackTimer();
  for (const handle of bandTimers.values()) clearTimeout(handle);
  bandTimers.clear();
  for (const handle of floaterTimers) clearTimeout(handle);
  floaterTimers.clear();

  _store?.$reset();
}

// ============================================
// Composable (for components)
// ============================================

/**
 * Composable for consuming lucky gift state in Vue components.
 */
export function useLuckyGift() {
  const store = useLuckySessionStore();
  const { floatingMultipliers, centerCashback, visibleBands } = storeToRefs(store);

  return {
    floatingMultipliers: readonly(floatingMultipliers),
    centerCashback: readonly(centerCashback),
    visibleBands,
  };
}

// ============================================
// Debug: Animation Simulator
// ============================================

/**
 * Simulate lucky draw visuals for testing.
 * Call from browser devtools: window.__luckySimulate.win(5)
 */
if (import.meta.dev && import.meta.client) {
  const simulators = {
    /** Simulate the sender's own win (center cashback) */
    win(multiplier = 5, coins = multiplier * 100): void {
      handleLuckyResult({
        multiplier,
        coins_won: coins,
        tier_name: 'Simulated',
        gift_name: 'Lucky Star',
      });
    },

    /** Simulate a room-scoped win (band + chat bubble) */
    roomWin(senderId = 1, multiplier = 5, coins = multiplier * 100): void {
      handleLuckyRoomResult({
        sender_id: senderId,
        gift_id: 0,
        gift_name: 'Lucky Star',
        multiplier,
        coins_won: coins,
        tier_name: 'Simulated',
        room_id: 0,
        has_slide: false,
      });
    },

    /** Simulate tap activity (sender band xN counter) */
    tap(senderId = 1, quantity = 1): void {
      recordLuckyGiftActivity({
        senderId,
        senderName: `Player ${senderId}`,
        senderAvatar: null,
        giftName: 'Lucky Star',
        recipientName: 'Host',
        recipientCount: 1,
        quantity,
      });
    },

    /** Simulate a no-draw notice floater (default: pool capped) */
    notice(reason: LuckyNoDrawReason = 'capped'): void {
      handleLuckyNoDraw({ reason, gift_id: 0, batch_id: 'sim' });
    },

    /** Rapid-fire burst: taps + mixed-tier wins — must never queue visuals */
    burst(): void {
      for (let i = 0; i < 10; i++) this.tap(1);
      this.win(5);
      this.win(5, 700);
      this.win(10);
      this.win(2);
      this.roomWin(1, 5);
      this.roomWin(1, 10);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__luckySimulate = simulators;
}
