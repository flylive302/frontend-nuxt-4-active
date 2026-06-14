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
import type { LuckyDrawResult } from '~/types/lucky';


// ============================================
// Constants
// ============================================

/** Max concurrent floating multipliers */
const MAX_FLOATERS = 5;

/** Time (ms) each floating multiplier stays visible */
const FLOATER_DURATION = 2500;

/** Lucky socket event names (used for cleanup) */
const LUCKY_EVENTS = ['lucky:result'] as const;

// ============================================
// Module-Level State
// ============================================

// Cached store reference — initialised in setupLuckyEventHandlers (setup context),
// then reused by socket callbacks that run outside Vue setup.
let _store: ReturnType<typeof useLuckySessionStore> | null = null;

let floaterIdCounter = 0;

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
  return 'lucky-float--tiny';
}

/**
 * Add a floating multiplier and auto-remove after duration.
 */
function addFloater(multiplier: number): void {
  const store = _store;
  if (!store) return;

  if (store.floatingMultipliers.length >= MAX_FLOATERS) {
    const first = store.floatingMultipliers[0];
    if (first) store.removeFloater(first.id);
  }

  const id = ++floaterIdCounter;
  store.addFloater({ id, multiplier, colorClass: getColorClass(multiplier) });

  setTimeout(() => {
    store.removeFloater(id);
  }, FLOATER_DURATION);
}

// ============================================
// Socket Handlers
// ============================================

function handleLuckyResult(data: LuckyDrawResult): void {
  addFloater(data.multiplier);
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
}

/**
 * Remove lucky socket listeners.
 * Called from useRoomEventHandlers.cleanupRoomEventHandlers().
 */
export function cleanupLuckyEventHandlers(socket: AudioSocket): void {
  for (const event of LUCKY_EVENTS) {
    socket.off(event);
  }
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

    /** Fire several floaters in sequence with delays */
    all(): void {
      this.float(0.01);
      setTimeout(() => this.float(0.25), 500);
      setTimeout(() => this.float(2.0), 1000);
      setTimeout(() => this.float(50.0), 1500);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__luckySimulate = simulators;
}
