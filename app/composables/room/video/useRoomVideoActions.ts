/**
 * Room Video — Controller / owner actions (INTENT -> GATE -> EXECUTE -> REACT).
 *
 * One function per stage:
 *   start:     gateStart     (GATE) -> emitPlay      (EXECUTE) -> reactToPlayFailure     (REACT)
 *   takeover:  gateTakeover  (GATE) -> emitTakeover  (EXECUTE) -> reactToTakeoverFailure (REACT)
 *   stop:      gateStop      (GATE) -> emitStop      (EXECUTE) -> toast on failure
 *   pause / resume / seek: gateTransport (GATE) -> emitTransport (EXECUTE) -> toast on failure
 *   heartbeat / ended: gateSender (GATE) -> emitSilent (EXECUTE + debug log) — no toast, ever
 *
 * The panel appearing / the player moving is the success feedback, so success
 * never toasts. Failures toast exactly once and resolve `false`; nothing here
 * throws. `heartbeat` / `ended` are the silent `RoomVideoTransport` the sync
 * composable drives: a failed one is retried by the next heartbeat.
 */
import type {
  RoomMediaSlotKind,
  RoomVideoSource,
  RoomVideoTransport,
  VideoPlayerAck,
  VideoSourceError,
} from '~/types/room/video';
import { ROOM_SOCKET_NOT_AUTHORIZED, ROOM_VIDEO_ERROR } from '~/constants/room';
import { useRoomVideoStore } from '~/stores/roomVideo';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { parseVideoSource } from '~/utils/video-source';

// ============================================
// Constants
// ============================================

const PLAY_EVENT = 'videoPlayer:play';
const TAKEOVER_EVENT = 'videoPlayer:takeover';
const STOP_EVENT = 'videoPlayer:stop';
const HEARTBEAT_EVENT = 'videoPlayer:heartbeat';
const ENDED_EVENT = 'videoPlayer:ended';

const TRANSPORT_EVENTS = {
  pause: 'videoPlayer:pause',
  resume: 'videoPlayer:resume',
  seek: 'videoPlayer:seek',
} as const;

const TOAST_TITLE = 'Video';

type ToastColor = 'warning' | 'error';
type TransportAction = keyof typeof TRANSPORT_EVENTS;

/** Copy for gate refusals and ack failures. Short, plain English. */
const COPY = {
  unavailable: "Room Video isn't available right now.",
  ownerOnly: 'Only the room owner and admins can start a video.',
  takeoverOwnerOnly: 'Only the room owner can take over.',
  musicPlaying: 'Music is playing — ask the DJ to stop it first.',
  videoPlaying: 'Another video is already playing.',
  sourceInvalid: "That link can't be played.",
  startFailed: "Couldn't start the video. Try again.",
  takeoverFailed: "Couldn't take over. Try again.",
  stopFailed: "Couldn't stop the video. Try again.",
  controllerOnly: 'Only the person controlling the video can stop it.',
  transportControllerOnly: 'Only the person controlling the video can do that.',
} as const;

const TRANSPORT_FAILED_COPY: Record<TransportAction, string> = {
  pause: "Couldn't pause the video. Try again.",
  resume: "Couldn't resume the video. Try again.",
  seek: "Couldn't move the video. Try again.",
};

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

/**
 * Outcome of `start`. On `ok: false`, `canTakeOver` is true only when the
 * media slot was busy AND the caller is the room owner: nothing was toasted and
 * the drawer offers a "Take over" button instead (`heldBy` says who holds the
 * slot; absent when the server did not say).
 */
export type StartResult = { ok: true } | { ok: false; canTakeOver: boolean; heldBy?: RoomMediaSlotKind };

export interface UseRoomVideoActionsReturn extends RoomVideoTransport {
  /** Parse + start a video (owner / admin). Never toasts for an owner's busy slot — see `StartResult`. */
  start(input: string): Promise<StartResult>;
  /** Owner force-takes the media slot (overwrites music AND video) and starts `input`. Resolves true only when accepted. */
  takeover(input: string): Promise<boolean>;
  /** Stop the current video (Controller only). Resolves true only when the server accepted it. */
  stop(): Promise<boolean>;
  /** Pause for everyone at `positionSec` (Controller only). */
  pause(positionSec: number): Promise<boolean>;
  /** Resume for everyone from `positionSec` (Controller only). */
  resume(positionSec: number): Promise<boolean>;
  /** Jump everyone to `positionSec`, keeping the paused state (Controller only). */
  seek(positionSec: number): Promise<boolean>;
}

interface RoomPayload {
  roomId: string;
}

interface PlayPayload extends RoomPayload {
  source: RoomVideoSource;
}

interface TransportPayload extends RoomPayload {
  positionSec: number;
}

interface HeartbeatPayload extends TransportPayload {
  paused: boolean;
}

type GateRefusal = { ok: false; message: string };
type StartGate = ({ ok: true } & PlayPayload) | GateRefusal;
type RoomGate = ({ ok: true } & RoomPayload) | GateRefusal;

type FailedAck = Extract<VideoPlayerAck, { success: false }>;

// ============================================
// Helpers (pure)
// ============================================

function isSlotBusy(ack: FailedAck): boolean {
  return ack.error === ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY;
}

/** Ack failure -> toast copy. Anything unrecognised gets the generic "try again". */
function describePlayFailure(ack: FailedAck): { message: string; color: ToastColor } {
  if (isSlotBusy(ack) && ack.data?.heldBy === 'music') return { message: COPY.musicPlaying, color: 'warning' };
  if (isSlotBusy(ack) && ack.data?.heldBy === 'video') return { message: COPY.videoPlaying, color: 'warning' };
  if (ack.error === ROOM_VIDEO_ERROR.DISABLED) return { message: COPY.unavailable, color: 'warning' };
  if (ack.error === ROOM_VIDEO_ERROR.SOURCE_INVALID) return { message: COPY.sourceInvalid, color: 'warning' };
  if (ack.error === ROOM_SOCKET_NOT_AUTHORIZED) return { message: COPY.ownerOnly, color: 'warning' };
  return { message: COPY.startFailed, color: 'error' };
}

/** Takeover never meets a busy slot (the server forces it), so only these remain. */
function describeTakeoverFailure(ack: FailedAck): { message: string; color: ToastColor } {
  if (ack.error === ROOM_VIDEO_ERROR.DISABLED) return { message: COPY.unavailable, color: 'warning' };
  if (ack.error === ROOM_VIDEO_ERROR.SOURCE_INVALID) return { message: COPY.sourceInvalid, color: 'warning' };
  if (ack.error === ROOM_SOCKET_NOT_AUTHORIZED) return { message: COPY.takeoverOwnerOnly, color: 'warning' };
  return { message: COPY.takeoverFailed, color: 'error' };
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
  const { canModerate, myRank } = useRoomHierarchy();
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

  function gateTakeover(input: string): StartGate {
    const roomId = store.roomId;
    if (!store.enabled || roomId === null) return { ok: false, message: COPY.unavailable };
    if (myRank.value !== 'owner') return { ok: false, message: COPY.takeoverOwnerOnly };

    const parsed = parseVideoSource(input);
    if (!parsed.ok) return { ok: false, message: PARSE_ERROR_COPY[parsed.error] };

    return { ok: true, roomId, source: parsed.source };
  }

  function gateStop(): RoomGate {
    const roomId = store.roomId;
    if (roomId === null || !store.isActive || !store.isController) {
      return { ok: false, message: COPY.controllerOnly };
    }
    return { ok: true, roomId };
  }

  /** pause / resume / seek: the server accepts transport from the holder only. */
  function gateTransport(): RoomGate {
    const roomId = store.roomId;
    if (!store.enabled || roomId === null) return { ok: false, message: COPY.unavailable };
    if (!store.isActive || !store.isController) return { ok: false, message: COPY.transportControllerOnly };
    return { ok: true, roomId };
  }

  /** Silent sender gate (heartbeat / ended): the room id, or null = do nothing. */
  function gateSender(): string | null {
    const roomId = store.roomId;
    return roomId !== null && store.isController ? roomId : null;
  }

  /** The drawer may offer "Take over" only for an owner who hit a busy slot. */
  function canOfferTakeover(ack: FailedAck): boolean {
    return isSlotBusy(ack) && myRank.value === 'owner';
  }

  // ========================================
  // EXECUTE (throws on timeout / disconnect, except emitSilent)
  // ========================================

  function emitPlay(payload: PlayPayload): Promise<VideoPlayerAck> {
    return emitAsync<PlayPayload, VideoPlayerAck>(PLAY_EVENT, payload);
  }

  function emitTakeover(payload: PlayPayload): Promise<VideoPlayerAck> {
    return emitAsync<PlayPayload, VideoPlayerAck>(TAKEOVER_EVENT, payload);
  }

  function emitStop(payload: RoomPayload): Promise<VideoPlayerAck> {
    return emitAsync<RoomPayload, VideoPlayerAck>(STOP_EVENT, payload);
  }

  function emitTransport(action: TransportAction, payload: TransportPayload): Promise<VideoPlayerAck> {
    return emitAsync<TransportPayload, VideoPlayerAck>(TRANSPORT_EVENTS[action], payload);
  }

  /** Fire-and-forget emit: never throws, never toasts; a failure is a debug line. */
  async function emitSilent(event: string, payload: RoomPayload | HeartbeatPayload): Promise<void> {
    try {
      const ack = await emitAsync<RoomPayload | HeartbeatPayload, VideoPlayerAck>(event, payload);
      if (!ack.success) log.debug(`${event} refused`, ack.error);
    } catch (error) {
      log.debug(`${event} did not complete`, error);
    }
  }

  // ========================================
  // REACT
  // ========================================

  function reactToPlayFailure(ack: FailedAck): void {
    const { message, color } = describePlayFailure(ack);
    notify(message, color);
  }

  function reactToTakeoverFailure(ack: FailedAck): void {
    const { message, color } = describeTakeoverFailure(ack);
    notify(message, color);
  }

  // ========================================
  // INTENT
  // ========================================

  async function start(input: string): Promise<StartResult> {
    const gate = gateStart(input);
    if (!gate.ok) {
      notify(gate.message, 'warning');
      return { ok: false, canTakeOver: false };
    }

    let ack: VideoPlayerAck;
    try {
      ack = await emitPlay({ roomId: gate.roomId, source: gate.source });
    } catch (error) {
      log.warn('videoPlayer:play did not complete', error);
      notify(COPY.startFailed, 'error');
      return { ok: false, canTakeOver: false };
    }

    if (ack.success) return { ok: true };
    if (canOfferTakeover(ack)) return { ok: false, canTakeOver: true, heldBy: ack.data?.heldBy };
    reactToPlayFailure(ack);
    return { ok: false, canTakeOver: false };
  }

  async function takeover(input: string): Promise<boolean> {
    const gate = gateTakeover(input);
    if (!gate.ok) {
      notify(gate.message, 'warning');
      return false;
    }

    let ack: VideoPlayerAck;
    try {
      ack = await emitTakeover({ roomId: gate.roomId, source: gate.source });
    } catch (error) {
      log.warn('videoPlayer:takeover did not complete', error);
      notify(COPY.takeoverFailed, 'error');
      return false;
    }

    if (ack.success) return true;
    reactToTakeoverFailure(ack);
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

  async function sendTransport(action: TransportAction, positionSec: number): Promise<boolean> {
    const gate = gateTransport();
    if (!gate.ok) {
      notify(gate.message, 'warning');
      return false;
    }

    let ack: VideoPlayerAck;
    try {
      ack = await emitTransport(action, { roomId: gate.roomId, positionSec });
    } catch (error) {
      log.warn(`videoPlayer:${action} did not complete`, error);
      notify(TRANSPORT_FAILED_COPY[action], 'error');
      return false;
    }

    if (ack.success) return true;
    log.warn(`videoPlayer:${action} refused`, ack.error);
    notify(TRANSPORT_FAILED_COPY[action], 'error');
    return false;
  }

  function pause(positionSec: number): Promise<boolean> {
    return sendTransport('pause', positionSec);
  }

  function resume(positionSec: number): Promise<boolean> {
    return sendTransport('resume', positionSec);
  }

  function seek(positionSec: number): Promise<boolean> {
    return sendTransport('seek', positionSec);
  }

  function heartbeat(positionSec: number, paused: boolean): void {
    const roomId = gateSender();
    if (roomId === null) return;
    void emitSilent(HEARTBEAT_EVENT, { roomId, positionSec, paused });
  }

  function ended(): void {
    const roomId = gateSender();
    if (roomId === null) return;
    void emitSilent(ENDED_EVENT, { roomId });
  }

  return { start, takeover, stop, pause, resume, seek, heartbeat, ended };
}
