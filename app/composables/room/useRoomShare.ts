// ========================================
// Room Share Composable
// ========================================

import { Share } from '@capacitor/share';
import {
  buildRoomSharePayload,
  formatShareForClipboard,
  isShareCancellation,
  type RoomSharePayload,
} from '~/utils/room-share';
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomShare]');

/** How the share was ultimately delivered. */
type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Share the current room.
 *
 * Transport chain — first one that works wins:
 *   Capacitor Share sheet → Web Share API → clipboard copy
 *
 * The native plugin is only present in a published AAB, so on an OTA-updated
 * shell that predates it `Share.canShare()` rejects with "not implemented" and
 * the chain falls through to the clipboard. That is the expected native
 * behaviour until the next store release — not an error path.
 */
export function useRoomShare() {
  const roomStore = useRoomStore();
  const toast = useToast();

  const sharing = ref(false);

  /**
   * INTENT + GATE + REACT for sharing the room the user is currently in.
   */
  async function shareRoom(): Promise<void> {
    // ---- GATE ----
    const room = roomStore.currentRoom;
    if (!room || sharing.value) return;

    sharing.value = true;

    // ---- EXECUTE ----
    const payload = buildRoomSharePayload({ id: room.id, name: room.name });
    const outcome = await deliverShare(payload);

    sharing.value = false;

    // ---- REACT ----
    if (outcome === 'copied') {
      toast.add({ title: 'Link copied', description: 'Paste it anywhere to invite friends.', color: 'success' });
      return;
    }

    if (outcome === 'failed') {
      toast.add({ title: 'Could not share', description: 'Sharing is unavailable on this device.', color: 'warning' });
    }

    // 'shared' and 'cancelled' are intentionally silent — the OS sheet is its
    // own feedback, and a dismissal is not a failure.
  }

  return { shareRoom, sharing: readonly(sharing) };
}

// ========================================
// Helpers
// ========================================

/**
 * Walk the transport chain until one delivers.
 */
async function deliverShare(payload: RoomSharePayload): Promise<ShareOutcome> {
  // Called directly rather than behind a `Share.canShare()` probe: the Web Share
  // API needs the click's transient activation, and an extra awaited round-trip
  // before `share()` risks losing it on stricter browsers.
  try {
    await Share.share(payload);
    return 'shared';
  }
  catch (error) {
    if (isShareCancellation(error)) return 'cancelled';
    // Plugin missing (pre-store-release native shell) or the sheet errored —
    // both are recoverable via the clipboard below.
    log.warn('Share sheet unavailable, falling back to clipboard', error);
  }

  return copyToClipboard(payload);
}

/**
 * Last-resort transport: put the message on the clipboard.
 */
async function copyToClipboard(payload: RoomSharePayload): Promise<ShareOutcome> {
  try {
    await navigator.clipboard.writeText(formatShareForClipboard(payload));
    return 'copied';
  }
  catch (error) {
    log.error('Clipboard write failed', error);
    return 'failed';
  }
}
