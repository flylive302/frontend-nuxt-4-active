/**
 * Room Video — start / stop actions (INTENT -> GATE -> EXECUTE -> REACT).
 *
 * One function per stage:
 *   start: gateStart (GATE) -> emitPlay (EXECUTE) -> reactToPlayFailure (REACT)
 *   stop:  gateStop  (GATE) -> emitStop (EXECUTE) -> reactToStopFailure (REACT)
 *
 * The panel appearing is the success feedback, so success never toasts.
 * Failures toast exactly once and resolve `false`; nothing here throws.
 */
import type { RoomVideoSource, VideoPlayerAck, VideoSourceError } from '~/types/room/video';
import { ROOM_SOCKET_NOT_AUTHORIZED, ROOM_VIDEO_ERROR } from '~/constants/room';
import { useRoomVideoStore } from '~/stores/roomVideo';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { parseVideoSource } from '~/utils/video-source';

// ============================================
// Constants
// ============================================

const PLAY_EVENT = 'videoPlayer:play';
const STOP_EVENT = 'videoPlayer:stop';

const TOAST_TITLE = 'Video';

type ToastColor = 'warning' | 'error';

/** Copy for gate refusals and ack failures. Short, plain English. */
const COPY = {
  unavailable: "Room Video isn't available right now.",
  ownerOnly: 'Only the room owner and admins can start a video.',
  musicPlaying: 'Music is playing — ask the DJ to stop it first.',
  videoPlaying: 'Another video is already playing.',
  sourceInvalid: "That link can't be played.",
  startFailed: "Couldn't start the video. Try again.",
  stopFailed: "Couldn't stop the video. Try again.",
  controllerOnly: 'Only the person controlling the video can stop it.',
} as const;

const PARSE_ERROR_COPY: Record<VideoSourceError, string> = {
  empty: 'Paste a video link first.',
  too_long: 'That link is too long.',
  invalid_url: "That doesn't look like a link.",
  not_https: 'Use an https:// link.',
  unsupported_scheme: 'Only web links can be played.',
  youtube_playlist: 'Paste one video, not a playlist.',
  youtube_channel: 'Paste one video, not a channel.',
  not_media: 'Use a YouTube link, or a direct .mp4 or .m3u8 link.',
};

// ============================================
// Types
// ============================================

export interface UseRoomVideoActionsReturn {
  /** Parse + start a video. Resolves true only when the server accepted it. */
  start(input: string): Promise<boolean>;
  /** Stop the current video (Controller only). Resolves true only when the server accepted it. */
  stop(): Promise<boolean>;
}

interface PlayPayload {
  roomId: string;
  source: RoomVideoSource;
}

interface StopPayload {
  roomId: string;
}

type GateRefusal = { ok: false; message: string };
type StartGate = ({ ok: true } & PlayPayload) | GateRefusal;
type StopGate = ({ ok: true } & StopPayload) | GateRefusal;

type FailedAck = Extract<VideoPlayerAck, { success: false }>;

// ============================================
// Helpers (pure)
// ============================================

/** Ack failure -> toast copy. Anything unrecognised gets the generic "try again". */
function describePlayFailure(ack: FailedAck): { message: string; color: ToastColor } {
  if (ack.error === ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY && ack.data?.heldBy === 'music') {
    return { message: COPY.musicPlaying, color: 'warning' };
  }
  if (ack.error === ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY && ack.data?.heldBy === 'video') {
    return { message: COPY.videoPlaying, color: 'warning' };
  }
  if (ack.error === ROOM_VIDEO_ERROR.DISABLED) return { message: COPY.unavailable, color: 'warning' };
  if (ack.error === ROOM_VIDEO_ERROR.SOURCE_INVALID) return { message: COPY.sourceInvalid, color: 'warning' };
  if (ack.error === ROOM_SOCKET_NOT_AUTHORIZED) return { message: COPY.ownerOnly, color: 'warning' };
  return { message: COPY.startFailed, color: 'error' };
}

// ============================================
// Composable
// ============================================

export function useRoomVideoActions(): UseRoomVideoActionsReturn {
  const log = createLogger('[RoomVideo]');
  // Resolved once in setup context: `useRoomHierarchy` owns a watchEffect, so it
  // must never be called per action.
  const store = useRoomVideoStore();
  const toast = useToast();
  const { canModerate } = useRoomHierarchy();
  const { socket } = useAudioSocket();
  const emitAsync = createEmitAsync(socket);

  // ========================================
  // Feedback
  // ========================================

  function notify(description: string, color: ToastColor): void {
    toast.add({ title: TOAST_TITLE, description, color });
  }

  // ========================================
  // GATE
  // ========================================

  function gateStart(input: string): StartGate {
    const roomId = store.roomId;
    if (!store.enabled || roomId === null) return { ok: false, message: COPY.unavailable };
    if (!canModerate.value) return { ok: false, message: COPY.ownerOnly };

    const parsed = parseVideoSource(input);
    if (!parsed.ok) return { ok: false, message: PARSE_ERROR_COPY[parsed.error] };

    return { ok: true, roomId, source: parsed.source };
  }

  function gateStop(): StopGate {
    const roomId = store.roomId;
    if (roomId === null || !store.isActive || !store.isController) {
      return { ok: false, message: COPY.controllerOnly };
    }
    return { ok: true, roomId };
  }

  // ========================================
  // EXECUTE (throws on timeout / disconnect)
  // ========================================

  function emitPlay(payload: PlayPayload): Promise<VideoPlayerAck> {
    return emitAsync<PlayPayload, VideoPlayerAck>(PLAY_EVENT, payload);
  }

  function emitStop(payload: StopPayload): Promise<VideoPlayerAck> {
    return emitAsync<StopPayload, VideoPlayerAck>(STOP_EVENT, payload);
  }

  // ========================================
  // REACT
  // ========================================

  function reactToPlayFailure(ack: FailedAck): void {
    const { message, color } = describePlayFailure(ack);
    notify(message, color);
  }

  // ========================================
  // INTENT
  // ========================================

  async function start(input: string): Promise<boolean> {
    const gate = gateStart(input);
    if (!gate.ok) {
      notify(gate.message, 'warning');
      return false;
    }

    let ack: VideoPlayerAck;
    try {
      ack = await emitPlay({ roomId: gate.roomId, source: gate.source });
    } catch (error) {
      log.warn('videoPlayer:play did not complete', error);
      notify(COPY.startFailed, 'error');
      return false;
    }

    if (ack.success) return true;
    reactToPlayFailure(ack);
    return false;
  }

  async function stop(): Promise<boolean> {
    const gate = gateStop();
    if (!gate.ok) {
      notify(gate.message, 'warning');
      return false;
    }

    let ack: VideoPlayerAck;
    try {
      ack = await emitStop({ roomId: gate.roomId });
    } catch (error) {
      log.warn('videoPlayer:stop did not complete', error);
      notify(COPY.stopFailed, 'error');
      return false;
    }

    if (ack.success) return true;
    log.warn('videoPlayer:stop refused', ack.error);
    notify(COPY.stopFailed, 'error');
    return false;
  }

  return { start, stop };
}
