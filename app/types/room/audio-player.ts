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
}

// ============================================
// SOCKET EVENT PAYLOADS
// ============================================

/** Client → MSAB: Start playing music */
export interface AudioPlayerPlayPayload {
  roomId: string;
  title: string;
  duration: number;
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
  /** The owner who took over. */
  byUserId: number;
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
}
