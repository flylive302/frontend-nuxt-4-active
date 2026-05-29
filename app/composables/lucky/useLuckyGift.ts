/**
 * Lucky Gift Composable
 *
 * Manages state for all 3 tiers of lucky draw animations:
 *   1. Floating multiplier text   (all wins — sender only)
 *   2. Room SVGA announcement     (Epic+ wins — all room users)
 *   3. App SVGA announcement      (Mega+ wins — all app users)
 *
 * Exposes setup/cleanup functions called by useRoomEventHandlers.ts
 * so lucky listeners are registered alongside all other room events.
 *
 * State is owned by useLuckySessionStore and consumed by dedicated
 * components mounted in the room page.
 */
import { ASSETS } from '~/constants/assets'
import type { AudioSocket } from '~/composables/room/useAudioSocket';
import type {
  LuckyDrawResult,
  LuckyRoomAnnouncement,
  LuckyAppAnnouncement,
} from '~/types/lucky';
import { createLogger } from '~/utils/logger';

const log = createLogger('[LuckyGift]');

// ============================================
// Constants
// ============================================

/** Max concurrent floating multipliers */
const MAX_FLOATERS = 5;

/** Time (ms) each floating multiplier stays visible */
const FLOATER_DURATION = 2500;

/** Lucky socket event names (used for cleanup) */
const LUCKY_EVENTS = [
  'lucky:result',
  'lucky:room_announcement',
  'lucky:app_announcement',
] as const;

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

function handleRoomAnnouncement(data: LuckyRoomAnnouncement): void {
  _store?.setRoomAnnouncement(data);
}

function handleAppAnnouncement(data: LuckyAppAnnouncement): void {
  _store?.setAppAnnouncement(data);
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
  socket.on('lucky:room_announcement', handleRoomAnnouncement);
  socket.on('lucky:app_announcement', handleAppAnnouncement);
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
  const {
    floatingMultipliers,
    roomAnnouncement,
    isRoomAnnouncementVisible,
    appAnnouncement,
    isAppAnnouncementVisible,
  } = storeToRefs(store);

  /**
   * Called by LuckyRoomAnnouncement component when animation completes.
   */
  function dismissRoomAnnouncement(): void {
    store.clearRoomAnnouncement();
  }

  /**
   * Called by LuckyAppAnnouncement component when animation completes.
   */
  function dismissAppAnnouncement(): void {
    store.clearAppAnnouncement();
  }

  return {
    // Tier 1: Floating multipliers
    floatingMultipliers: readonly(floatingMultipliers),

    // Tier 2: Room announcement
    roomAnnouncement: readonly(roomAnnouncement),
    isRoomAnnouncementVisible: readonly(isRoomAnnouncementVisible),
    dismissRoomAnnouncement,

    // Tier 3: App announcement
    appAnnouncement: readonly(appAnnouncement),
    isAppAnnouncementVisible: readonly(isAppAnnouncementVisible),
    dismissAppAnnouncement,
  };
}

// ============================================
// Debug: Animation Simulator
// ============================================

/**
 * Simulate lucky draw animations for testing.
 * Call from browser devtools: window.__luckySimulate.float(2.5)
 *
 * Available methods:
 *   float(multiplier)         — Floating multiplier text
 *   roomAnnouncement(mult)    — Room SVGA slide-in
 *   appAnnouncement(mult)     — App-wide SVGA slide-in
 *   all()                     — Fire all 3 in sequence
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

    /** Simulate room announcement */
    roomAnnouncement(multiplier = 5.0): void {
      handleRoomAnnouncement({
        user_id: 0,
        user_name: 'TestUser',
        user_avatar: ASSETS.DEFAULT_FRAME,
        multiplier,
        coins_won: Math.round(multiplier * 100),
        tier_name: 'Epic',
        room_name: 'Test Room',
        svga_url: ASSETS.DEFAULT_FRAME,
      });
    },

    /** Simulate app-wide announcement */
    appAnnouncement(multiplier = 50.0): void {
      handleAppAnnouncement({
        user_id: 0,
        user_name: 'TestUser',
        user_avatar: ASSETS.DEFAULT_FRAME,
        multiplier,
        coins_won: Math.round(multiplier * 100),
        tier_name: 'Mega',
        room_id: 0,
        room_name: 'Test Room',
        svga_url: ASSETS.DEFAULT_FRAME,
      });
    },

    /** Fire all 3 animations in sequence with delays */
    all(): void {
      this.float(0.01);
      setTimeout(() => this.float(0.25), 500);
      setTimeout(() => this.float(2.0), 1000);
      setTimeout(() => this.roomAnnouncement(5.0), 2000);
      setTimeout(() => this.appAnnouncement(50.0), 8000);
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__luckySimulate = simulators;
}
