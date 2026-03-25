/**
 * Lucky Gift Fly Composable
 *
 * Manages the fly animation for lucky category gifts.
 * Thumbnails fly from sender seat → screen center → receiver seat → disappear.
 *
 * Uses Web Animations API for GPU-composited performance (transform + opacity only).
 * Module-level state enables concurrent fly animations without conflicts.
 */
import { LUCKY_FLY_THUMBNAIL_SIZE } from '~/constants/gift';

// ========================================
// Types
// ========================================

/** Coordinates for a position on screen */
interface FlyPosition {
  readonly x: number;
  readonly y: number;
}

/** A single fly animation item */
export interface LuckyFlyItem {
  readonly id: string;
  readonly thumbnailUrl: string;
  readonly startPos: FlyPosition;
  readonly centerPos: FlyPosition;
  readonly endPos: FlyPosition;
}

// ========================================
// Module-Level State
// ========================================

/** Active fly animation items (multiple can coexist) */
const flyItems = ref<LuckyFlyItem[]>([]);

/** Half-size offset for centering thumbnail on a position */
const HALF_SIZE = LUCKY_FLY_THUMBNAIL_SIZE / 2;

// ========================================
// Position Resolution
// ========================================

/**
 * Resolve the center position of a user's seat element.
 * Falls back to screen bottom-center if user is not seated.
 *
 * @param userId - The user ID to locate
 * @returns Center coordinates of the user's seat
 */
function resolveSeatPosition(userId: number): FlyPosition {
  const el = document.querySelector<HTMLElement>(`[data-user-id="${userId}"]`);

  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - HALF_SIZE,
      y: rect.top + rect.height / 2 - HALF_SIZE,
    };
  }

  // Fallback: bottom-center of viewport
  return {
    x: window.innerWidth / 2 - HALF_SIZE,
    y: window.innerHeight - LUCKY_FLY_THUMBNAIL_SIZE - 32,
  };
}

/**
 * Calculate the center position of the viewport.
 * @returns Center coordinates of the screen
 */
function getScreenCenter(): FlyPosition {
  return {
    x: window.innerWidth / 2 - HALF_SIZE,
    y: window.innerHeight / 2 - HALF_SIZE,
  };
}

// ========================================
// Fly Lifecycle
// ========================================

/**
 * Remove a fly item by its ID after animation completes.
 * @param id - The fly item ID to remove
 */
function removeFlyItem(id: string): void {
  const index = flyItems.value.findIndex((item) => item.id === id);
  if (index !== -1) {
    flyItems.value.splice(index, 1);
  }
}

/**
 * Generate a unique ID for a fly item.
 * Uses timestamp + random suffix for uniqueness under rapid fire.
 */
function generateFlyId(): string {
  return `fly-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
    const item: LuckyFlyItem = {
      id: generateFlyId(),
      thumbnailUrl,
      startPos: resolveSeatPosition(senderId),
      centerPos: getScreenCenter(),
      endPos: resolveSeatPosition(recipientId),
    };

    flyItems.value.push(item);
  }

  return {
    /** Reactive list of active fly items (drives component rendering) */
    flyItems: readonly(flyItems),
    /** Trigger a new fly animation */
    triggerFly,
    /** Remove a fly item after animation completes (called by component) */
    removeFlyItem,
  };
}
