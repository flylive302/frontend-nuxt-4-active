import type { types as mediasoupTypes } from 'mediasoup-client';
import type { Socket } from 'socket.io-client';
import type { MinimalUser } from '../user/bootstrap';
import type { MusicPlayerJoinState } from './audio-player';
import type { SlidePlayPayload } from '../slide';

// Re-export mediasoup types for convenience
export type RtpCapabilities = mediasoupTypes.RtpCapabilities;
export type RtpParameters = mediasoupTypes.RtpParameters;
export type DtlsParameters = mediasoupTypes.DtlsParameters;
export type IceParameters = mediasoupTypes.IceParameters;
export type IceCandidate = mediasoupTypes.IceCandidate;

// ============================================
// SOCKET CONNECTION
// ============================================

export interface SocketAuthPayload {
  token: string;
}

export interface SocketErrorEvent {
  message: string;
  errors?: Record<string, string[]>;
}

/** Typed Socket interface for audio server communication */
export type AudioSocket = Socket;

// ============================================
// ROOM EVENTS
// ============================================

export interface JoinRoomPayload {
  roomId: string;
  seatCount?: number;
}



export interface JoinRoomResponse {
  rtpCapabilities?: RtpCapabilities;
  participants?: RoomParticipant[];
  seats?: { seatIndex: number; userId: number; isMuted: boolean }[];
  lockedSeats?: number[];
  existingProducers?: { producerId: string; userId: number; source?: ProducerSource }[];
  musicPlayer?: MusicPlayerJoinState | null;
  /** App-scope slides still inside their replay window — shown to this late joiner. */
  activeAppSlides?: SlidePlayPayload[];
  error?: string;
  /** Present when `error === 'room_blocked'` (ADR 0017 / room-blocks 03). */
  permanent?: boolean;
  /** Seconds remaining on the block, or null when `permanent` is true. */
  remaining_seconds?: number | null;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface UserJoinedEvent {
  userId: number;
  user: RoomParticipant;
}

export interface UserLeftEvent {
  userId: number;
}

export interface RoomClosedEvent {
  roomId: string;
  reason: 'host_left' | 'banned' | 'admin_closed' | string;
  timestamp: number;
}

/**
 * room:mode — MSAB flipped the Room's audio-delivery tier (realtime-08/09).
 * On a flip the client records the new mode AND the broadcast HLS playback URL,
 * so Listeners already in the Room switch transport immediately (realtime-09).
 */
export interface RoomModeChangedEvent {
  roomId: string;
  mode: 'interactive' | 'broadcast';
  transition: 'promote' | 'demote' | null;
  listenerCount: number;
  /** Broadcast HLS playback URL when publishing; null in interactive / not provisioned. */
  hlsPlaybackUrl: string | null;
  timestamp: number;
}

// ============================================
// UNIFIED MEDIA RESPONSE
// ============================================

/**
 * Unified response wrapper for all media socket events.
 * All media event callbacks return this shape with the actual data nested inside `data`.
 */
export interface MediaResponse<T = Record<string, unknown>> {
  success: boolean;
  error?: string;
  data?: T;
}

// ============================================
// TRANSPORT EVENTS
// ============================================

export interface TransportCreatePayload {
  type: 'producer' | 'consumer';
  roomId: string;
}

export interface TransportCreateData {
  id: string;
  iceParameters: IceParameters;
  iceCandidates: IceCandidate[];
  dtlsParameters: DtlsParameters;
  iceServers?: RTCIceServer[];
}

export type TransportCreateResponse = MediaResponse<TransportCreateData>;

export interface TransportConnectPayload {
  roomId: string;
  transportId: string;
  dtlsParameters: DtlsParameters;
}

export interface TransportConnectResponse {
  success?: boolean;
  error?: string;
}

// ============================================
// AUDIO EVENTS
// ============================================

/** Producer purpose tag. Missing/undefined on the wire is treated as `'mic'` (compat). */
export type ProducerSource = 'mic' | 'music';

export interface AudioProducePayload {
  roomId: string;
  transportId: string;
  kind: 'audio';
  rtpParameters: RtpParameters;
  source: ProducerSource;
}

export interface AudioProduceData {
  id: string;
}

export type AudioProduceResponse = MediaResponse<AudioProduceData>;

export interface AudioConsumePayload {
  roomId: string;
  transportId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

export interface AudioConsumeData {
  id: string;
  producerId: string;
  kind: 'audio';
  rtpParameters: RtpParameters;
}

export type AudioConsumeResponse = MediaResponse<AudioConsumeData>;

export interface ConsumerResumePayload {
  roomId: string;
  consumerId: string;
}

export interface ConsumerResumeResponse {
  success?: boolean;
  error?: string;
}

export interface NewProducerEvent {
  producerId: string;
  userId: number;
  kind: 'audio';
  /** Absent on pre-feature servers/peers — treat as `'mic'` (compat). */
  source?: ProducerSource;
}

export interface ProducerClosedEvent {
  producerId: string;
  userId?: number;
}

export interface ActiveSpeakerEvent {
  userId: string;
  activeSpeakers?: string[];
  timestamp: number;
}

export interface SelfMutePayload {
  roomId: string;
  producerId: string;
}

export interface SelfMuteResponse {
  success?: boolean;
  error?: string;
}

// ============================================
// SEAT MANAGEMENT EVENTS
// ============================================

export interface SeatTakePayload {
  roomId: string;
  seatIndex: number;
}

export interface SeatLeavePayload {
  roomId: string;
}

export interface SeatAssignPayload {
  roomId: string;
  userId: number;
  seatIndex: number;
}

export interface SeatRemovePayload {
  roomId: string;
  userId: number;
}

export interface SeatMutePayload {
  roomId: string;
  userId: number;
}

export interface SeatResponse {
  success?: boolean;
  error?: string;
}

export interface SeatUpdatedEvent {
  seatIndex: number;
  userId: number;
  isMuted: boolean;
}

export interface SeatClearedEvent {
  seatIndex: number;
  userId?: number;
  /**
   * "grace" = MSAB's delayed retention-sweep release (realtime-22), NOT an
   * explicit leave/kick. Only grace clears may be swallowed by the
   * self-retake guard (F-24).
   *
   * "shrink" = room-seat-caps/02 shrink eviction. The evicted user also
   * receives a targeted `seat:evicted` with the dedicated toast/teardown, so
   * the generic own-seat "Removed from seat" handling here must yield to it
   * instead of double-firing.
   *
   * "removed" = owner/admin forced removal (seat:remove). The ONLY reason
   * that shows the "Removed from seat" toast — voluntary leave is untagged
   * and stays silent.
   */
  reason?: 'grace' | 'shrink' | 'removed';
}

/**
 * Targeted `seat:evicted` (room-seat-caps/02) — sent ONLY to the displaced
 * user's own room-scoped sockets when a live shrink removes their seat.
 * The room-wide `seat:cleared` (reason: "shrink") already reached everyone
 * else; this event exists purely to drive this user's dedicated toast.
 */
export interface SeatEvictedEvent {
  roomId: string;
  seatIndex: number;
  newSeatCount: number;
}

export interface SeatUserMutedEvent {
  userId: number;
  isMuted: boolean;
  selfMuted?: boolean;
}

/** Broadcast for `seat:reaction` (ADR 0015) — includes the sender. */
export interface SeatReactionEvent {
  userId: number;
  code: string;
}

export interface SeatLockedEvent {
  seatIndex: number;
  isLocked: boolean;
}

export interface SeatInviteReceivedEvent {
  seatIndex: number;
  invitedById: number;
  expiresAt: number;
  targetUserId: number;
}

// ============================================
// CHAT EVENTS (Ephemeral - no persistence)
// ============================================

export interface ChatMessagePayload {
  roomId: string;
  content: string;
  type?: string;
}

export interface ChatMessageEvent {
  id: string;
  userId: number;
  userName?: string | null;
  userAvatar?: string | null;
  userFrameId?: number | null;
  userChatBubbleId?: number | null;
  content: string;
  type: string;
  timestamp: number;
}

// ============================================
// GIFT EVENTS
// ============================================

export interface GiftSendPayload {
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity?: number;
}

export interface GiftReceivedEvent {
  senderId: number;
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
  /**
   * Groups all per-recipient emits from one send/combo press. Receivers
   * coalesce events sharing a batchId into a single full-screen playback.
   * Optional for backward compatibility with un-upgraded MSAB instances.
   */
  batchId?: string;
}

export interface GiftErrorEvent {
  transactionId: string;
  code: number | string;
  reason: string;
  /** @deprecated Use `code` — kept for backward compatibility */
  error?: 'insufficient_balance' | 'invalid_gift' | string;
  /** @deprecated Use `reason` — kept for backward compatibility */
  message?: string;
}

export interface GiftPrepareEvent {
  giftId: number;
  recipientId: number;
}

// ============================================
// ROOM STATE TYPES
// ============================================

/**
 * Participant in a room — identity only.
 * Seat/speaker state is derived from the seats store (Issue 05 will re-introduce those fields).
 */
export type RoomParticipant = MinimalUser;

/**
 * State of audio connection
 */
export interface AudioState {
  isConnected: boolean;
  isProducing: boolean;
  isMuted: boolean;
  activeSpeakerIds: number[];
}

/**
 * Seat in the room (15 seats total, 0-14)
 */
export interface Seat {
  index: number;
  occupantId: number | null;
  isMuted: boolean;
  isActive: boolean;
  isLocked: boolean;
}

/** Seat with the live participant object resolved — what components consume. */
export interface SeatWithUser extends Omit<Seat, 'occupantId'> {
  occupantId: number | null;
  user: RoomParticipant | null;
}

/**
 * Convert User/BootstrapUser to RoomParticipant.
 * Accepts any object with at minimum id and name fields.
 */
export function userToParticipant(user: MinimalUser, overrides?: Partial<RoomParticipant>): RoomParticipant {
  return {
    id: user.id,
    name: user.name,
    signature: user.signature,
    avatar: user.avatar,
    frame_id: user.frame_id,
    chat_bubble_id: user.chat_bubble_id,
    entry_animation_id: user.entry_animation_id,
    data_card_id: user.data_card_id,
    mice_wave_id: user.mice_wave_id,
    slides_id: user.slides_id,
    cover_image: user.cover_image,
    gender: user.gender,
    country: user.country,
    date_of_birth: user.date_of_birth,
    wealth_xp: user.wealth_xp,
    charm_xp: user.charm_xp,
    vip_level: user.vip_level,
    equipped_badges: user.equipped_badges ?? [],
    ...overrides,
  };
}

// ============================================
// CONSTANTS
// ============================================

export const TOTAL_SEATS = 15;
export const RATE_LIMIT_MESSAGES_PER_MINUTE = 60;
export const RATE_LIMIT_GIFTS_PER_MINUTE = 120;
