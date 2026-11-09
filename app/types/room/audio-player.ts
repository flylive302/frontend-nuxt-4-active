/**
 * Audio Player Types
 *
 * Types for the room audio player feature.
 * The audio player allows one user per room to play music from a local file,
 * streaming it through their existing mediasoup producer transport.
 */

// ============================================
// PLAYBACK STATE
// ============================================

export type AudioPlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

export interface AudioPlayerState {
  /** Current playback status */
  status: AudioPlayerStatus;
  /** User ID of the person playing music (null if no one is playing) */
  userId: number | null;
  /** Track title (filename or metadata) */
  title: string | null;
  /** Total duration in seconds */
  duration: number;
  /** Current playback position in seconds */
  position: number;
}

// ============================================
// PLAYLIST QUEUE
// ============================================

/**
 * A single queued track in the DJ's session-local Playlist.
 *
 * Holds only a cheap `File` handle plus derived metadata — never decoded PCM /
 * `AudioBuffer`. The playback engine (separate module) owns decoding and bounds
 * resident PCM to ~1–2 songs; keeping the queue handle-only is what lets it
 * survive Stop / force-take for free (see ADR 0006 memory model).
 */
export interface Track {
  /** Stable, client-generated unique id (survives reorder/remove). */
  id: string;
  /** The DJ's local device file — decoded on demand by the engine, not here. */
  file: File;
  /** Display title, derived from the filename (extension stripped). */
  title: string;
  /** Duration in seconds, written back by the engine once decoded; `null` until known. */
  duration: number | null;
  /**
   * room-music-playlist/01: set when a song restored from the device store can
   * no longer be read (storage evicted by the OS). The row stays so the DJ sees
   * what was lost and can remove it.
   */
  unavailable?: boolean;
}

// ============================================
// SOCKET EVENT PAYLOADS
// ============================================

/** Client → MSAB: Start playing music */
export interface AudioPlayerPlayPayload {
  roomId: string;
  title: string;
  duration: number;
  /**
   * music-dj-queue/04: opt in to the FIFO waiting queue on a live-holder denial.
   * Sent true only for the non-force first-track acquire; omitted (server default
   * false) keeps the legacy "denied" behavior. Track-change/takeover emits omit it.
   */
  enqueue?: boolean;
}

/** Client → MSAB: Owner force-takes a live music slot (same shape as play). */
export interface AudioPlayerTakeoverPayload {
  roomId: string;
  title: string;
  duration: number;
}

/** Client → MSAB: Stop playing music */
export interface AudioPlayerStopPayload {
  roomId: string;
}

/**
 * Client → MSAB: cancel a waiting-queue spot (music-dj-queue/05). Emitted when a
 * queued admin presses stop/close or leaves the room while still waiting, so the
 * server dequeues them instead of granting the slot to someone who changed their
 * mind.
 */
export interface AudioPlayerLeaveQueuePayload {
  roomId: string;
}

/** Client → MSAB: Periodic state update */
export interface AudioPlayerStateUpdatePayload {
  roomId: string;
  position: number;
  isPaused: boolean;
}

/** MSAB → Room: State changed broadcast */
export interface AudioPlayerStateChangedEvent {
  state: 'playing' | 'paused' | 'stopped';
  userId: number;
  title?: string | null;
  duration?: number;
  position: number;
}

/** MSAB → displaced DJ (targeted): the owner force-took the music slot. */
export interface AudioPlayerRevokedEvent {
  roomId: string;
  /** The owner who took over — or, with `reason: 'video'`, whoever started the Room Video. */
  byUserId: number;
  /**
   * room-video-player/03: `'video'` = a Room Video took the media slot (the DJ's own
   * included). Absent = the room owner force-took the music.
   */
  reason?: 'video';
}

/**
 * MSAB → queue head (targeted): the music slot is now provisionally yours.
 * music-dj-queue/04 — the grantee auto-starts their first queued track through
 * the normal play flow (which succeeds via reuse-if-mine against the provisional
 * mutex). No payload beyond the room for scope-matching.
 */
export interface AudioPlayerGrantedEvent {
  roomId: string;
}

/** Music player state from room:join ack */
export interface MusicPlayerJoinState {
  userId: number;
  title: string;
  duration: number;
  position: number;
  isPaused: boolean;
}

/** Generic socket ack response */
export interface AudioPlayerResponse {
  success: boolean;
  error?: string;
  /** music-dj-queue/04: true when a denied play was placed in the waiting queue. */
  queued?: boolean;
  /** music-dj-queue/04: 1-based position in the waiting queue (with `queued`). */
  position?: number;
  /** room-video-player/03: with `error: 'media_slot_busy'`, who holds the slot (never queued). */
  data?: { heldBy: 'music' | 'video'; userId: number };
}
