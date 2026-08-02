// ========================================
// Room share — pure helpers
// ========================================

import {
  PLAY_STORE_URL,
  ROOM_SHARE_DIALOG_TITLE,
  ROOM_SHARE_TEXT_TEMPLATE,
  ROOM_SHARE_TITLE_TEMPLATE,
} from '~/constants/share';

/** A room reduced to the fields a share payload needs. */
export interface ShareableRoom {
  id: number;
  name: string;
}

/** Normalised share payload — shape accepted by both `Share.share` and `navigator.share`. */
export interface RoomSharePayload {
  title: string;
  text: string;
  url: string;
  dialogTitle: string;
}

/**
 * Build the share payload for a room.
 *
 * Pure: no platform lookups, no reactivity — the transport decides how to use it.
 */
export function buildRoomSharePayload(room: ShareableRoom): RoomSharePayload {
  const name = room.name.trim() || `Room #${room.id}`;

  return {
    title: ROOM_SHARE_TITLE_TEMPLATE.replace('{name}', name),
    text: ROOM_SHARE_TEXT_TEMPLATE.replace('{name}', name).replace('{id}', String(room.id)),
    url: PLAY_STORE_URL,
    dialogTitle: ROOM_SHARE_DIALOG_TITLE,
  };
}

/** Flatten a payload into a single string for the clipboard fallback. */
export function formatShareForClipboard(payload: RoomSharePayload): string {
  return `${payload.text}\n${payload.url}`;
}

/**
 * Did the user dismiss the share sheet rather than the share failing?
 *
 * A cancel must stay silent — no error toast, no Sentry noise. The Web Share
 * API raises `AbortError`; Capacitor's Android bridge rejects with a plain
 * "Share canceled" message and no error name, so both are matched.
 */
export function isShareCancellation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === 'AbortError') return true;

  return typeof message === 'string' && /cancel+ed|canceled|cancelled|abort/i.test(message);
}
