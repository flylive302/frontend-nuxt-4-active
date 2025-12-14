import type {
  JoinRoomResponse,
  UserJoinedEvent,
  UserLeftEvent,
  RoomClosedEvent,
  NewProducerEvent,
  ChatMessageEvent,
  GiftReceivedEvent,
  GiftErrorEvent,
  ActiveSpeakerEvent,
  SeatUpdatedEvent,
  SeatClearedEvent,
  SeatUserMutedEvent,
  SeatLockedEvent,
  SeatInviteReceivedEvent,
  SeatResponse,
} from '~/types/audio';
import { userToParticipant } from '~/types/audio';
import type { AudioSocket } from './useAudioSocket';

// ============================================
// Types
// ============================================

export interface UseRoomAudioReturn {
  /** Join a room with audio capabilities */
  joinRoom: (roomId: string) => Promise<void>;
  /** Leave the current room */
  leaveRoom: () => void;
  /** Start producing audio (take a seat first) */
  startAudio: () => Promise<void>;
  /** Stop producing audio */
  stopAudio: () => void;
  /** Take an available seat */
  takeSeat: (seatIndex: number) => Promise<boolean>;
  /** Leave current seat */
  leaveSeat: () => Promise<boolean>;
  /** Owner: Assign user to seat */
  assignUserToSeat: (userId: number, seatIndex: number) => Promise<boolean>;
  /** Owner: Remove user from seat */
  removeUserFromSeat: (userId: number) => Promise<boolean>;
  /** Owner: Mute user */
  muteUser: (userId: number) => Promise<boolean>;
  /** Owner: Unmute user */
  unmuteUser: (userId: number) => Promise<boolean>;
  /** Owner: Lock a seat */
  lockSeat: (seatIndex: number) => Promise<boolean>;
  /** Owner: Unlock a seat */
  unlockSeat: (seatIndex: number) => Promise<boolean>;
  /** Owner: Invite user to a seat */
  inviteToSeat: (userId: number, seatIndex: number) => Promise<boolean>;
  /** Accept pending invite */
  acceptInvite: () => Promise<boolean>;
  /** Decline pending invite */
  declineInvite: () => Promise<boolean>;
  /** Send chat message */
  sendChatMessage: (content: string, type?: string) => void;
  /** Send gift */
  sendGift: (giftId: number, recipientId: number, quantity?: number) => void;
  /** Connection status */
  connectionStatus: Ref<'disconnected' | 'connecting' | 'connected' | 'error'>;
  /** Whether connected to audio server */
  isConnected: ComputedRef<boolean>;
  /** Whether producing audio */
  isProducing: ComputedRef<boolean>;
  /** Whether local microphone is muted */
  isLocalMuted: Ref<boolean>;
  /** Toggle local microphone mute */
  toggleLocalMute: () => boolean;
}

// ============================================
// Composable
// ============================================

/**
 * Main orchestrator composable for room audio functionality.
 * Combines socket connection, mediasoup, and room state management.
 */
export function useRoomAudio(): UseRoomAudioReturn {
  // ========================================
  // Composables / Dependencies
  // ========================================
  const roomStore = useRoomStore();
  const authStore = useAuthStore();
  const toast = useToast();

  // Socket and mediasoup instances
  const { socket, connect, disconnect, status: connectionStatus, isConnected } = useAudioSocket();
  const {
    loadDevice,
    createTransports,
    startAudio: startMediasoupAudio,
    stopAudio: stopMediasoupAudio,
    consumeProducer,
    cleanup: cleanupMediasoup,
    isProducing,
    isLocalMuted,
    toggleLocalMute,
  } = useMediasoup(socket);

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Emit socket event with promise-based response
   */
  function emitAsync<TPayload, TResponse>(event: string, payload: TPayload): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:109',message:'emitAsync called',data:{event,payload},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (!socket.value) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:112',message:'emitAsync socket not connected',data:{event},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        reject(new Error('Socket not connected'));
        return;
      }
      const timeoutId = setTimeout(() => {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:120',message:'emitAsync timeout',data:{event,payload},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        reject(new Error(`Socket event ${event} timed out after 10 seconds`));
      }, 10000);
      socket.value.emit(event, payload, (response: TResponse) => {
        clearTimeout(timeoutId);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:125',message:'emitAsync callback received',data:{event,response},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        resolve(response);
      });
    });
  }

  /**
   * Setup all socket event listeners for room events
   */
  function setupEventListeners() {
    if (!socket.value) return;

    const s = socket.value as AudioSocket;

    // Room events
    s.on('room:userJoined', (event: UserJoinedEvent) => {
      roomStore.addParticipant(event.user);
      console.log('[RoomAudio] User joined:', event.user.name);
    });

    s.on('room:userLeft', (event: UserLeftEvent) => {
      roomStore.removeParticipant(event.userId);
      console.log('[RoomAudio] User left:', event.userId);
    });

    s.on('room:closed', (event: RoomClosedEvent) => {
      toast.add({
        title: 'Room closed',
        description: `The room has been closed: ${event.reason}`,
        color: 'warning',
      });
      leaveRoom();
      navigateTo('/');
    });

    // Audio events
    s.on('audio:newProducer', async (event: NewProducerEvent) => {
      console.log('[RoomAudio] New producer from user:', event.userId);
      if (roomStore.currentRoom) {
        await consumeProducer(event.producerId, roomStore.currentRoom.id.toString());
      }
    });

    s.on('speaker:active', (event: ActiveSpeakerEvent) => {
      roomStore.setActiveSpeaker(parseInt(event.userId));
    });

    // Seat events
    s.on('seat:updated', (event: SeatUpdatedEvent) => {
      roomStore.updateSeat(event.seatIndex, event.user, event.isMuted);
    });

    s.on('seat:cleared', (event: SeatClearedEvent) => {
      // Check if current user was on this seat before clearing
      const seat = roomStore.seats[event.seatIndex];
      const wasCurrentUserSeated = seat?.user?.id === authStore.user?.id;

      roomStore.clearSeat(event.seatIndex);

      // If current user was kicked, stop their audio
      if (wasCurrentUserSeated) {
        console.log('[RoomAudio] User was kicked from seat, stopping audio');
        stopMediasoupAudio();
        toast.add({
          title: 'Removed from seat',
          description: 'You have been removed from your seat',
          color: 'warning',
        });
      }
    });

    s.on('seat:userMuted', (event: SeatUserMutedEvent) => {
      roomStore.setParticipantMuted(event.userId, event.isMuted);
    });

    s.on('seat:locked', (event: SeatLockedEvent) => {
      roomStore.setSeatLocked(event.seatIndex, event.isLocked);
    });

    // Invite events
    s.on('seat:invite:received', (event: SeatInviteReceivedEvent) => {
      // Only show toast if this invite is for the current user
      if (event.targetUserId === authStore.user?.id) {
        toast.add({
          id: `seat-invite-${event.seatIndex}`,
          title: 'Seat Invitation',
          description: `${event.invitedBy.name} invited you to Seat ${event.seatIndex + 1}`,
          color: 'primary',
          duration: 30000,
          actions: [
            {
              label: 'Accept',
              color: 'primary',
              onClick: async () => {
                await acceptInvite();
                await startAudio();
              },
            },
            {
              label: 'Decline',
              color: 'neutral',
              onClick: () => void declineInvite(),
            },
          ],
        });
      }
    });

    // Chat events
    s.on('chat:message', (event: ChatMessageEvent) => {
      roomStore.addMessage(event);
    });

    // Gift events
    s.on('gift:received', (event: GiftReceivedEvent) => {
      roomStore.handleGiftReceived(event);
    });

    s.on('gift:error', (event: GiftErrorEvent) => {
      if (event.error === 'insufficient_balance') {
        toast.add({
          title: 'Insufficient balance',
          description: 'Please top up your coins to send gifts.',
          color: 'error',
        });
      } else {
        toast.add({
          title: 'Gift failed',
          description: 'Failed to send gift. Please try again.',
          color: 'error',
        });
      }
    });
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Join a room with audio capabilities.
   * Connects to audio server, joins room, and sets up transports.
   */
  async function joinRoom(roomId: string): Promise<void> {
    // Connect to audio server
    connect();

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      if (isConnected.value) {
        resolve();
        return;
      }

      const unwatch = watch(connectionStatus, (newStatus) => {
        if (newStatus === 'connected') {
          unwatch();
          resolve();
        } else if (newStatus === 'error') {
          unwatch();
          reject(new Error('Failed to connect to audio server'));
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        unwatch();
        reject(new Error('Connection timeout'));
      }, 10000);
    });

    // Setup event listeners
    setupEventListeners();

    // Join room via socket (send owner ID so server can cache it)
    const ownerId = roomStore.currentRoom?.user?.id;
    const response = await emitAsync<{ roomId: string; ownerId?: number }, JoinRoomResponse>(
      'room:join',
      { roomId, ownerId }
    );

    if (response.error || !response.rtpCapabilities) {
      throw new Error(response.error || 'Failed to join room');
    }

    // Load mediasoup device
    await loadDevice(response.rtpCapabilities);

    // Create transports
    await createTransports(roomId);

    // Update store
    roomStore.setAudioConnected(true);

    // Add self to participants
    if (authStore.user) {
      const participant = userToParticipant(authStore.user, { isSpeaker: false });
      roomStore.addParticipant(participant);
    }

    // Handle initial room state from server
    // 1. Add existing participants
    if (response.participants && response.participants.length > 0) {
      console.log('[RoomAudio] Adding', response.participants.length, 'existing participants');
      for (const p of response.participants) {
        roomStore.addParticipant({
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          isSpeaker: p.isSpeaker,
        });
      }
    }

    // 2. Initialize seats from server state
    // Initialize empty/locked seats state
    if (response.seats) {
      response.seats.forEach((seat) => {
        roomStore.updateSeat(seat.seatIndex, seat.user, seat.isMuted);
      });
    }

    // Initialize locked seats (if provided by server)
    if (response.lockedSeats) {
      response.lockedSeats.forEach((seatIndex: number) => {
        roomStore.setSeatLocked(seatIndex, true);
      });
    }

    // 3. Consume existing producers (listen to active speakers)
    if (response.existingProducers && response.existingProducers.length > 0) {
      console.log('[RoomAudio] Consuming', response.existingProducers.length, 'existing producers');
      for (const producer of response.existingProducers) {
        try {
          await consumeProducer(producer.producerId, roomId);
        } catch (err) {
          console.warn('[RoomAudio] Failed to consume producer:', producer.producerId, err);
        }
      }
    }

    console.log('[RoomAudio] Joined room:', roomId);
  }

  /**
   * Leave the current room and clean up all resources.
   */
  function leaveRoom(): void {
    if (socket.value && roomStore.currentRoom) {
      socket.value.emit('room:leave', { roomId: roomStore.currentRoom.id.toString() });
    }

    // Cleanup mediasoup
    cleanupMediasoup();

    // Disconnect socket
    disconnect();

    // Clear room state
    roomStore.clearAudioState();

    console.log('[RoomAudio] Left room');
  }

  /**
   * Start producing audio from microphone.
   */
  async function startAudio(): Promise<void> {
    await startMediasoupAudio();
    roomStore.setProducing(true);
  }

  /**
   * Stop producing audio.
   */
  function stopAudio(): void {
    stopMediasoupAudio();
    roomStore.setProducing(false);
  }

  /**
   * Take an available seat.
   */
  async function takeSeat(seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:take', {
      roomId: roomStore.currentRoom.id.toString(),
      seatIndex,
    });

    if (response.error) {
      toast.add({ title: 'Cannot take seat', description: response.error, color: 'error' });
      return false;
    }

    // Update local seat state for the current user
    // (Socket.IO's socket.to() excludes sender, so we update locally)
    if (response.success && authStore.user) {
      const currentUser = userToParticipant(authStore.user, { isSpeaker: true, seatIndex });
      roomStore.updateSeat(seatIndex, currentUser, false);
    }

    return response.success ?? false;
  }

  /**
   * Leave current seat.
   */
  async function leaveSeat(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    // Find current user's seat before leaving
    const currentUserSeatIndex = authStore.user
      ? roomStore.seats.findIndex((s) => s.user?.id === authStore.user!.id)
      : -1;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:leave', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    if (response.error) {
      toast.add({ title: 'Cannot leave seat', description: response.error, color: 'error' });
      return false;
    }

    // Clear local seat state
    // (Socket.IO's socket.to() excludes sender, so we update locally)
    if (response.success && currentUserSeatIndex >= 0) {
      roomStore.clearSeat(currentUserSeatIndex);
    }

    stopAudio();
    return response.success ?? false;
  }

  /**
   * Owner: Assign a user to a seat.
   */
  async function assignUserToSeat(userId: number, seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number; seatIndex: number }, SeatResponse>(
      'seat:assign',
      {
        roomId: roomStore.currentRoom.id.toString(),
        userId,
        seatIndex,
      }
    );

    if (response.error) {
      toast.add({ title: 'Cannot assign seat', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Owner: Remove a user from their seat.
   */
  async function removeUserFromSeat(userId: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:remove', {
      roomId: roomStore.currentRoom.id.toString(),
      userId,
    });

    if (response.error) {
      toast.add({ title: 'Cannot remove user', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Owner: Mute a user.
   */
  async function muteUser(userId: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:mute', {
      roomId: roomStore.currentRoom.id.toString(),
      userId,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Unmute a user.
   */
  async function unmuteUser(userId: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:unmute', {
      roomId: roomStore.currentRoom.id.toString(),
      userId,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Lock a seat.
   */
  async function lockSeat(seatIndex: number): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:524',message:'lockSeat called',data:{seatIndex,roomId:roomStore.currentRoom?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!roomStore.currentRoom) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:526',message:'lockSeat no current room',data:{seatIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return false;
    }

    try {
      const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:lock', {
        roomId: roomStore.currentRoom.id.toString(),
        seatIndex,
      });
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:533',message:'lockSeat response received',data:{seatIndex,success:response.success,error:response.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return response.success ?? false;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:537',message:'lockSeat error',data:{seatIndex,error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }

  /**
   * Owner: Unlock a seat.
   */
  async function unlockSeat(seatIndex: number): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:unlock', {
      roomId: roomStore.currentRoom.id.toString(),
      seatIndex,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Invite user to a seat.
   */
  async function inviteToSeat(userId: number, seatIndex: number): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:552',message:'inviteToSeat called',data:{userId,seatIndex,roomId:roomStore.currentRoom?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!roomStore.currentRoom) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:554',message:'inviteToSeat no current room',data:{userId,seatIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return false;
    }

    try {
      const response = await emitAsync<{ roomId: string; userId: number; seatIndex: number }, SeatResponse>(
        'seat:invite',
        {
          roomId: roomStore.currentRoom.id.toString(),
          userId,
          seatIndex,
        }
      );
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:567',message:'inviteToSeat response received',data:{userId,seatIndex,success:response.success,error:response.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (response.error) {
        toast.add({ title: 'Cannot invite', description: response.error, color: 'error' });
        return false;
      }

      return response.success ?? false;
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/8a897506-63a2-4b32-97bd-dcb4f465f57e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useRoomAudio.ts:575',message:'inviteToSeat error',data:{userId,seatIndex,error:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      throw error;
    }
  }

  /**
   * Accept pending invite.
   */
  async function acceptInvite(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:invite:accept', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    if (response.error) {
      toast.add({ title: 'Cannot accept invite', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Decline pending invite.
   */
  async function declineInvite(): Promise<boolean> {
    if (!roomStore.currentRoom) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:invite:decline', {
      roomId: roomStore.currentRoom.id.toString(),
    });

    return response.success ?? false;
  }

  /**
   * Send a chat message.
   */
  function sendChatMessage(content: string, type: string = 'text'): void {
    if (!socket.value || !roomStore.currentRoom) return;

    socket.value.emit('chat:message', {
      roomId: roomStore.currentRoom.id.toString(),
      content,
      type,
    });
  }

  /**
   * Send a gift to a user.
   */
  function sendGift(giftId: number, recipientId: number, quantity: number = 1): void {
    if (!socket.value || !roomStore.currentRoom) return;

    socket.value.emit('gift:send', {
      roomId: roomStore.currentRoom.id.toString(),
      giftId,
      recipientId,
      quantity,
    });
  }

  // ========================================
  // Return
  // ========================================
  return {
    joinRoom,
    leaveRoom,
    startAudio,
    stopAudio,
    takeSeat,
    leaveSeat,
    assignUserToSeat,
    removeUserFromSeat,
    muteUser,
    unmuteUser,
    lockSeat,
    unlockSeat,
    inviteToSeat,
    acceptInvite,
    declineInvite,
    sendChatMessage,
    sendGift,
    connectionStatus,
    isConnected,
    isProducing,
    isLocalMuted,
    toggleLocalMute,
  };
}
