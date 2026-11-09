/**
 * Room Video platform rules (room-video-player 08)
 *
 * Pure decisions that depend on where the app runs:
 * - may this platform embed the YouTube iframe at all (ticket 01 decision row,
 *   `ROOM_VIDEO_YOUTUBE_EMBED`), or does it show the "Open on YouTube" card;
 * - should a player be mounted right now — on Capacitor a collapsed YouTube
 *   iframe is unmounted (not hidden) to free the decoder, except for the
 *   Controller, whose player drives the heartbeat and `ended`;
 * - the public watch URL the card opens, at the room's current second.
 *
 * Framework-free: no Vue, no DOM, no Capacitor. The platform read lives in the
 * composable layer (`useRoomVideoYouTube`).
 */
import { ROOM_VIDEO_YOUTUBE_EMBED, type RoomVideoPlatform } from '~/constants/room';
import type { RoomVideoSource } from '~/types/room/video';

const YOUTUBE_WATCH_URL = 'https://www.youtube.com/watch';

/** `Capacitor.getPlatform()` → our platform; anything unexpected is treated as the web. */
export function toRoomVideoPlatform(capacitorPlatform: string): RoomVideoPlatform {
  if (capacitorPlatform === 'android' || capacitorPlatform === 'ios') return capacitorPlatform;
  return 'web';
}

/** `false` = this platform shows the "Open on YouTube" card instead of the iframe. */
export function canEmbedYouTube(platform: RoomVideoPlatform): boolean {
  return ROOM_VIDEO_YOUTUBE_EMBED[platform];
}

export interface VideoPlayerMountInput {
  kind: RoomVideoSource['kind'];
  platform: RoomVideoPlatform;
  collapsed: boolean;
  isController: boolean;
}

/**
 * Should the sync hold a live player for this Source right now? `false` means
 * "no player, and not a failure": the Snapshot keeps running and the panel shows
 * the card (no embed) or the collapsed bar (unmounted iframe).
 */
export function shouldMountVideoPlayer(input: VideoPlayerMountInput): boolean {
  if (input.kind !== 'youtube') return true;
  if (!canEmbedYouTube(input.platform)) return false;
  const unmountsWhenCollapsed = input.platform !== 'web';
  return !(unmountsWhenCollapsed && input.collapsed && !input.isController);
}

/** The public watch page for `videoId`, starting at `atSec` (whole seconds; 0 / negative = start). */
export function youTubeWatchUrl(videoId: string, atSec = 0): string {
  const url = new URL(YOUTUBE_WATCH_URL);
  url.searchParams.set('v', videoId);
  const start = Math.floor(atSec);
  if (Number.isFinite(start) && start > 0) url.searchParams.set('t', `${start}s`);
  return url.toString();
}
