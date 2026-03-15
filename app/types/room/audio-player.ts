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
// SOCKET EVENT PAYLOADS
// ============================================

/** Client → MSAB: Start playing music */
export interface AudioPlayerPlayPayload {
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
