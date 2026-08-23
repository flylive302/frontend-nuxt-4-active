/**
 * Lucky Gift Fly Composable
 *
 * Manages the fly animation for lucky category gifts.
 * Thumbnails fly from sender seat → screen center → receiver seat → disappear.
 *
 * Rendering is a single canvas driven by `LuckyFlyRenderer`; this composable
 * only resolves WHERE a fly goes (seat positions) and hands the request over.
 * Seat positions are cached (`LUCKY_FLY_SEAT_CACHE_TTL_MS`) because measuring
 * a seat forces a layout and a burst fires hundreds of legs per second.
 */
import { LUCKY_FLY_SEAT_CACHE_TTL_MS, LUCKY_FLY_THUMBNAIL_SIZE } from '~/constants/gift';
import type { LuckyFlyRenderer } from '~/services/luckyFlyRenderer';
import { useFxPreferencesStore } from '~/stores/fxPreferences';
import type { FlyPoint } from '~/utils/lucky-fly-path';

// ========================================
// Module-Level State
// ========================================

/** The mounted canvas renderer, or null while no LuckyGiftFly is on screen. */
let renderer: LuckyFlyRenderer | null = null;

/** Called after every enqueue so the component can (re)start its frame loop. */
let onEnqueue: (() => void) | null = null;

interface CachedSeat {
  readonly point: FlyPoint;
  readonly measuredAt: number;
}

const seatCache = new Map<number, CachedSeat>();

// ========================================
// Position Resolution
// ========================================

/**
 * Center of a user's seat element, cached per TTL. Falls back to
 * bottom-center of the viewport when the user is not seated.
 */
function resolveSeatPosition(userId: number, now: number): FlyPoint {
  const cached = seatCache.get(userId);
  if (cached && now - cached.measuredAt < LUCKY_FLY_SEAT_CACHE_TTL_MS) return cached.point;

  const el = document.querySelector<HTMLElement>(`[data-user-id="${userId}"]`);
  const point: FlyPoint = el
    ? centerOf(el.getBoundingClientRect())
    : { x: window.innerWidth / 2, y: window.innerHeight - LUCKY_FLY_THUMBNAIL_SIZE / 2 - 32 };
  seatCache.set(userId, { point, measuredAt: now });
  return point;
}

function centerOf(rect: DOMRect): FlyPoint {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getScreenCenter(): FlyPoint {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

// ========================================
// Composable
// ========================================

export function useLuckyFly() {
  /**
   * Trigger a fly animation for a lucky gift.
   *
   * @param thumbnailUrl - CDN URL of the gift thumbnail
   * @param senderId - User ID of the sender (start position)
   * @param recipientId - User ID of the recipient (end position)
   */
  function triggerFly(thumbnailUrl: string, senderId: number, recipientId: number): void {
    // GATE: Gift Mute preference suppresses the fly visual on this device only —
    // the lucky send/win itself (balances, session state) is already booked.
    if (useFxPreferencesStore().muteGiftAnimations) return;
    // GATE: no canvas mounted (not on the room page) — nothing to draw on.
    if (!renderer) return;

    const now = performance.now();
    renderer.enqueue({
      thumbnailUrl,
      path: {
        start: resolveSeatPosition(senderId, now),
        center: getScreenCenter(),
        end: resolveSeatPosition(recipientId, now),
      },
    });
    onEnqueue?.();
  }

  /** Component hook: register the mounted renderer and its wake-up callback. */
  function attachRenderer(next: LuckyFlyRenderer, wake: () => void): void {
    renderer = next;
    onEnqueue = wake;
  }

  /** Component hook: forget the renderer on unmount. */
  function detachRenderer(): void {
    renderer = null;
    onEnqueue = null;
    seatCache.clear();
  }

  /** Seats moved (resize, orientation, layout change) — re-measure lazily. */
  function invalidateSeatPositions(): void {
    seatCache.clear();
  }

  return { triggerFly, attachRenderer, detachRenderer, invalidateSeatPositions };
}
