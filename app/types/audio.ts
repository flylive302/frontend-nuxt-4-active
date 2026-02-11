import type { types as mediasoupTypes } from 'mediasoup-client';
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
  seatCount?: number;
}

export interface JoinRoomResponse {
  rtpCapabilities?: RtpCapabilities;
  participants?: RoomParticipant[];
  seats?: { seatIndex: number; userId: number; isMuted: boolean }[];
  lockedSeats?: number[];
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

export interface AudioProducePayload {
  roomId: string;
  transportId: string;
  kind: 'audio';
  rtpParameters: RtpParameters;
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
}

export interface SeatUserMutedEvent {
  userId: number;
  isMuted: boolean;
  selfMuted?: boolean;
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
  userName: string;
  avatar?: string;
  frame?: string;
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
  activeSpeakerIds: number[];
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
 * Convert User/BootstrapUser to RoomParticipant.
 * Accepts any object with at minimum id and name fields.
 */
export function userToParticipant(user: MinimalUser, overrides?: Partial<RoomParticipant>): RoomParticipant {
  return {
    id: user.id,
    name: user.name,
    signature: user.signature,
    avatar: user.avatar,
    frame: user.frame,
    gender: user.gender,
    phone: user.phone,
    email: user.email ?? null,
    country: user.country,
    date_of_birth: user.date_of_birth,
    wealth_xp: user.wealth_xp,
    charm_xp: user.charm_xp,
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
