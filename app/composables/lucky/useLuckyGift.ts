/**
 * Lucky Gift Composable
 *
 * Manages the floating multiplier text shown to the sender on every lucky win
 * (`lucky:result`). Bigger room/app win announcements are no longer lucky-specific
 * — they flow through the unified slide overlay (`slide:play`, see slide.events.ts
 * and ADR 0009), so this composable only owns the sender-side floaters now.
 *
 * Exposes setup/cleanup functions called by useRoomEventHandlers.ts so the lucky
 * listener is registered alongside all other room events.
 *
 * State is owned by useLuckySessionStore.
 */
import type { AudioSocket } from '~/composables/room/useAudioSocket';
import type { FloatingMultiplier, LuckyDrawResult, LuckyNoDrawPayload, LuckyNoDrawReason } from '~/types/lucky';
import { createLogger } from '~/utils/logger';

const logger = createLogger('[LuckyGift]');


// ============================================
// Constants
// ============================================

/** Max concurrent floating multipliers */
const MAX_FLOATERS = 5;

/** Time (ms) a win/bust multiplier floater stays visible (bust == win) */
const FLOATER_DURATION = 2500;

/** Time (ms) a no-draw notice floater stays visible — longer, to be read */
const NOTICE_DURATION = 3500;

/** Sender-facing copy per no-draw reason (honest, non-alarming) */
const NO_DRAW_COPY: Record<LuckyNoDrawReason, string> = {
  capped: 'pool capped for today',
  user_capped: 'your daily win limit reached',
  disabled: 'lucky draws unavailable',
  no_eligible_tier: 'lucky draws unavailable',
};

/** Lucky socket event names (used for cleanup) */
const LUCKY_EVENTS = ['lucky:result', 'lucky:no-draw'] as const;

// ============================================
// Module-Level State
// ============================================

// Cached store reference — initialised in setupLuckyEventHandlers (setup context),
// then reused by socket callbacks that run outside Vue setup.
let _store: ReturnType<typeof useLuckySessionStore> | null = null;

let floaterIdCounter = 0;

/**
 * Reasons already surfaced this room session — throttles no-draw notices to one
 * per reason so spamming gifts can't flood the screen. Cleared on room leave.
 */
const shownNoticeReasons = new Set<LuckyNoDrawReason>();

// ============================================
// Helpers
// ============================================

/**
 * Resolve color class from multiplier value.
 */
function getColorClass(multiplier: number): string {
  if (multiplier >= 100) return 'lucky-float--jackpot';
  if (multiplier >= 10) return 'lucky-float--epic';
  if (multiplier >= 2) return 'lucky-float--great';
  if (multiplier >= 1) return 'lucky-float--good';
  if (multiplier > 0) return 'lucky-float--tiny';
  return 'lucky-float--bust';
}

/**
 * Push any floater through the shared store pipeline and auto-remove after its
 * duration. Evicts the oldest when at MAX_FLOATERS so the queue stays bounded.
 */
function pushFloater(entry: FloatingMultiplier, duration: number): void {
  const store = _store;
  if (!store) return;

  if (store.floatingMultipliers.length >= MAX_FLOATERS) {
    const first = store.floatingMultipliers[0];
    if (first) store.removeFloater(first.id);
  }

  store.addFloater(entry);

  setTimeout(() => {
    store.removeFloater(entry.id);
  }, duration);
}

/**
 * Add a floating multiplier (win or ×0 bust) — bust shares the win duration.
 */
function addMultiplierFloater(multiplier: number): void {
  pushFloater(
    { id: ++floaterIdCounter, kind: 'multiplier', multiplier, colorClass: getColorClass(multiplier) },
    FLOATER_DURATION,
  );
}

/**
 * Add a text notice floater (no-draw hint) through the same pipeline.
 */
function addNoticeFloater(text: string): void {
  pushFloater(
    { id: ++floaterIdCounter, kind: 'notice', text, colorClass: 'lucky-float--notice' },
    NOTICE_DURATION,
  );
}

// ============================================
// Socket Handlers
// ============================================

function handleLuckyResult(data: LuckyDrawResult): void {
  addMultiplierFloater(data.multiplier);
}

/**
 * Typed "no draw" signal (Epic B ticket 08): the draw was skipped for a
 * user-visible reason (capped / user_capped / disabled / no_eligible_tier).
 * Renders one notice floater per reason per room session so no skip is silent
 * and repeats don't flood the screen; the throttle resets on room leave.
 */
function handleLuckyNoDraw(data: LuckyNoDrawPayload): void {
  if (shownNoticeReasons.has(data.reason)) return;
  shownNoticeReasons.add(data.reason);

  addNoticeFloater(NO_DRAW_COPY[data.reason] ?? NO_DRAW_COPY.disabled);
  logger.debug('lucky:no-draw rendered', data);
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
}

/**
 * Remove lucky socket listeners.
 * Called from useRoomEventHandlers.cleanupRoomEventHandlers().
 */
export function cleanupLuckyEventHandlers(socket: AudioSocket): void {
  for (const event of LUCKY_EVENTS) {
    socket.off(event);
  }
  // Room leave: forget which no-draw notices were shown so the next session
  // surfaces each reason once again.
  shownNoticeReasons.clear();
}

// ============================================
// Composable (for components)
// ============================================

/**
 * Composable for consuming lucky gift state in Vue components.
 */
export function useLuckyGift() {
  const store = useLuckySessionStore();
  const { floatingMultipliers } = storeToRefs(store);

  return {
    floatingMultipliers: readonly(floatingMultipliers),
  };
}

// ============================================
// Debug: Animation Simulator
// ============================================

/**
 * Simulate lucky draw floaters for testing.
 * Call from browser devtools: window.__luckySimulate.float(2.5)
 */
if (import.meta.dev && import.meta.client) {
  const simulators = {
    /** Simulate a floating multiplier */
    float(multiplier = 2.5): void {
      handleLuckyResult({
        multiplier,
        coins_won: Math.round(multiplier * 100),
        tier_name: 'Simulated',
        gift_name: 'Lucky Star',
      });
    },

    /** Simulate a no-draw notice floater (default: pool capped) */
    notice(reason: LuckyNoDrawReason = 'capped'): void {
      handleLuckyNoDraw({ reason, gift_id: 0, batch_id: 'sim' });
    },

    /** Fire several floaters in sequence with delays */
    all(): void {
      this.float(0.01);
      setTimeout(() => this.float(0.25), 500);
      setTimeout(() => this.float(2.0), 1000);
      setTimeout(() => this.float(50.0), 1500);
    },

    /** Fire one notice per reason (resets the throttle first so all show) */
    notices(): void {
      shownNoticeReasons.clear();
      const reasons: LuckyNoDrawReason[] = ['capped', 'user_capped', 'disabled', 'no_eligible_tier'];
      reasons.forEach((reason, i) => setTimeout(() => this.notice(reason), i * 600));
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__luckySimulate = simulators;
}
