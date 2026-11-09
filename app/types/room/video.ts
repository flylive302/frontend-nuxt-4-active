/**
 * Room Video Types
 *
 * Types for the "watch a video together" room feature. One user (the
 * controller) picks a video and drives play / pause / seek; every listener
 * derives the playback position from the same server-stamped snapshot.
 *
 * Types only: parsing lives in `~/utils/video-source`, the sync clock maths in
 * `~/utils/video-clock`.
 */

// ============================================
// VIDEO SOURCE
// ============================================

/** Container of a direct (non-YouTube) video URL; picks the player backend. */
export type VideoContainer = 'mp4' | 'hls';

/**
 * Where the video comes from. A YouTube source carries only the 11-char video
 * id (every URL shape normalises to it); a direct URL carries the full https
 * URL plus the container it was recognised as.
 */
export type RoomVideoSource =
  | { kind: 'youtube'; videoId: string }
  | { kind: 'url'; url: string; container: VideoContainer };

/** Why `parseVideoSource` refused an input. */
export type VideoSourceError =
  /** Blank input (after trimming). */
  | 'empty'
  /** Longer than `ROOM_VIDEO_URL_MAX_LENGTH`. */
  | 'too_long'
  /** Not parseable as a URL at all. */
  | 'invalid_url'
  /** Plain `http:` direct URL (YouTube links are exempt, see `parseVideoSource`). */
  | 'not_https'
  /** Any scheme other than http(s): `javascript:`, `data:`, `blob:`, `file:`, ... */
  | 'unsupported_scheme'
  /** A YouTube playlist, not a single video. */
  | 'youtube_playlist'
  /** A YouTube channel / user page, not a single video. */
  | 'youtube_channel'
  /** A URL we cannot play: no `.mp4` / `.m3u8` path, or a YouTube page without a video id. */
  | 'not_media';

/** Result of `parseVideoSource`: a normalised source, or the reason it was refused. */
export type VideoSourceParseResult =
  | { ok: true; source: RoomVideoSource }
  | { ok: false; error: VideoSourceError };

// ============================================
// SYNC SNAPSHOT
// ============================================

/**
 * Authoritative playback state, stamped by the server. Listeners never trust a
 * "current position" directly; they compute it from the snapshot with
 * `expectedPosition` so late joiners and slow packets land on the same frame.
 */
export interface RoomVideoSnapshot {
  /** User ID of the person controlling playback. */
  controllerUserId: number;
  /** What is playing. */
  source: RoomVideoSource;
  /** Display title, when known. */
  title?: string;
  /** Total duration in seconds, when known; bounds the expected position. */
  durationSec?: number;
  /** True while playback is paused. */
  paused: boolean;
  /** Playback position in seconds at the moment `serverTs` was stamped. */
  positionAtTs: number;
  /** Server clock, epoch milliseconds, when this snapshot was stamped. */
  serverTs: number;
  /** Monotonic version; a listener ignores a snapshot older than the one it holds. */
  revision: number;
}

// ============================================
// SOCKET CONTRACT (MSAB video-player domain, room-video-player 02 + 03)
// ============================================

/** `videoPlayer:stateChanged` — to the whole room, sender included. `null` = no Room Video. */
export interface VideoPlayerStateChangedEvent {
  roomId: string;
  snapshot: RoomVideoSnapshot | null;
}

/** Why the server took the Room Video away from this user (absent on old servers). */
export type VideoPlayerRevokedReason = 'takeover' | 'music';

/** `videoPlayer:revoked` — targeted at the displaced Controller's sockets in the room. */
export interface VideoPlayerRevokedEvent {
  roomId: string;
  byUserId: number;
  reason?: VideoPlayerRevokedReason;
}

/** Which mutex refused a start: another user's DJ music or Room Video. */
export type RoomMediaSlotKind = 'music' | 'video';

/**
 * Ack of every `videoPlayer:*` emit. `ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY` carries who
 * holds the slot in `data`; the other codes are in `ROOM_VIDEO_ERROR`
 * (`~/constants/room`), plus generic server strings ("Not authorized", ...).
 */
export type VideoPlayerAck =
  | { success: true }
  | { success: false; error: string; data?: { heldBy: RoomMediaSlotKind; userId: number } };

/** Fields the `room:join` ack adds. All optional: an old MSAB omits them (= feature off). */
export interface RoomVideoJoinAckFields {
  videoPlayerEnabled?: boolean;
  videoPlayer?: RoomVideoSnapshot | null;
  /**
   * MSAB clock (epoch ms) when it sent the ack; present only when the flag is on.
   * The late joiner's first clock sample is `serverNow - receivedAtLocalMs`.
   */
  serverNow?: number;
}

// ============================================
// PLAYER ADAPTER (one interface, one implementation per backend)
// ============================================

/**
 * `blocked` = the browser refused unmuted autoplay (`NotAllowedError`); the UI
 * shows one "Tap to watch" overlay and retries `play()` from the tap.
 */
export type VideoAdapterEvent = 'ready' | 'playing' | 'paused' | 'ended' | 'error' | 'blocked';

/** Payload of an adapter `error` event. `code` is backend-specific (MediaError code, hls.js type, YouTube code). */
export interface VideoAdapterError {
  code: string;
  message: string;
}

/**
 * A playback backend bound to one container element. The sync composable owns
 * exactly one adapter at a time and drives it from the Snapshot; the adapter
 * never reads stores or talks to the socket.
 */
export interface VideoPlayerAdapter {
  /** Load a source (replaces any current one). Does not start playback. */
  load(source: RoomVideoSource): void;
  /** Start playback. Never rejects: an autoplay refusal emits `blocked`, other failures emit `error`. */
  play(): Promise<void>;
  pause(): void;
  /** Seek to an absolute position in seconds. */
  seek(sec: number): void;
  /** Current playback position in seconds (0 before anything loaded). */
  currentTime(): number;
  /** Local mute; never affects other Watchers. */
  setMuted(muted: boolean): void;
  /** Stop playback, release decoders / hls.js / iframes, remove the element. Idempotent. */
  destroy(): void;
  /** Subscribe; returns the unsubscribe function. */
  on(event: VideoAdapterEvent, cb: (error?: VideoAdapterError) => void): () => void;
}

/** Builds an adapter that renders inside `container` (the panel's player slot). */
export type VideoPlayerAdapterFactory = (container: HTMLElement) => VideoPlayerAdapter;
