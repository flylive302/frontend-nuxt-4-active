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
