import type { types as mediasoupTypes } from 'mediasoup-client';
import type { User } from './auth';
import type { MinimalUser } from './bootstrap';

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

// ============================================
// ROOM EVENTS
// ============================================

export interface JoinRoomPayload {
  roomId: string;
}

export interface JoinRoomResponse {
  rtpCapabilities?: RtpCapabilities;
  participants?: RoomParticipant[];
  seats?: { seatIndex: number; user: RoomParticipant | null; isMuted: boolean }[];
  lockedSeats?: number[]; // Added: List of locked seat indices
  existingProducers?: { producerId: string; userId: number }[];
  error?: string;
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

// ============================================
// TRANSPORT EVENTS
// ============================================

export interface TransportCreatePayload {
  type: 'producer' | 'consumer';
  roomId: string;
}

export interface TransportCreateResponse {
  id?: string;
  iceParameters?: IceParameters;
  iceCandidates?: IceCandidate[];
  dtlsParameters?: DtlsParameters;
  error?: string;
  details?: Record<string, unknown>;
}

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

export interface AudioProducePayload {
  roomId: string;
  transportId: string;
  kind: 'audio';
  rtpParameters: RtpParameters;
}

export interface AudioProduceResponse {
  id?: string;
  error?: string;
}

export interface AudioConsumePayload {
  roomId: string;
  transportId: string;
  producerId: string;
  rtpCapabilities: RtpCapabilities;
}

export interface AudioConsumeResponse {
  id?: string;
  producerId?: string;
  kind?: 'audio';
  rtpParameters?: RtpParameters;
  error?: string;
}

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
}

export interface ActiveSpeakerEvent {
  userId: string;
  volume: number;
  timestamp: number;
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
  user: RoomParticipant | null;
  isMuted: boolean;
}

export interface SeatClearedEvent {
  seatIndex: number;
}

export interface SeatUserMutedEvent {
  userId: number;
  isMuted: boolean;
}

export interface SeatLockedEvent {
  seatIndex: number;
  isLocked: boolean;
}

export interface SeatInviteReceivedEvent {
  seatIndex: number;
  invitedBy: { id: number; name: string };
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
  userName: string;
  avatar?: string;
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
  senderName: string;
  senderAvatar: string;
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
}

export interface GiftErrorEvent {
  transactionId: string;
  error: 'insufficient_balance' | 'invalid_gift' | string;
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
 * Participant in a room (extends MinimalUser with room-specific fields)
 */
export interface RoomParticipant extends MinimalUser {
  // Room-specific fields
  isSpeaker: boolean;
  seatIndex?: number;
  isMuted?: boolean;
}

/**
 * State of audio connection
 */
export interface AudioState {
  isConnected: boolean;
  isProducing: boolean;
  isMuted: boolean;
  activeSpeakerId: number | null;
}

/**
 * Seat in the room (15 seats total, 0-14)
 */
export interface Seat {
  index: number;
  user: RoomParticipant | null;
  isMuted: boolean;
  isActive: boolean;
  isLocked: boolean;
}

/**
 * Convert User to RoomParticipant
 */
export function userToParticipant(user: MinimalUser, overrides?: Partial<RoomParticipant>): RoomParticipant {
  return {
    id: user.id,
    name: user.name ?? 'Anonymous',
    signature: user.signature ?? '',
    avatar: user.avatar ?? null,
    gender: user.gender ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    country: user.country ?? null,
    date_of_birth: user.date_of_birth ?? null,
    wealth_xp: String(user.wealth_xp ?? '0'),
    charm_xp: String(user.charm_xp ?? '0'),
    isSpeaker: false,
    isMuted: false,
    ...overrides,
  };
}

// ============================================
// CONSTANTS
// ============================================

export const TOTAL_SEATS = 15;
export const RATE_LIMIT_MESSAGES_PER_MINUTE = 60;
export const RATE_LIMIT_GIFTS_PER_MINUTE = 120;
