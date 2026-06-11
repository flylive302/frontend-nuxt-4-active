/**
 * Room Gifts Composable
 *
 * Handles gift queue processing for rate-limited gift sending.
 * Uses module-level state for the gift queue to prevent duplicates.
 */
import { ref, type Ref } from 'vue';
import { GIFT_QUEUE_INTERVAL_MS } from '../../constants/gift';
import type { AudioSocket } from './useAudioSocket';

// ============================================
// Types
// ============================================

/** Data required for an outgoing gift socket message */
export interface QueuedGift {
  roomId: string;
  giftId: number;
  recipientId: number;
  quantity: number;
}

// ============================================
// Module-Level State
// ============================================

/** Outgoing gift queue to handle rapid combo sends */
const giftQueue: QueuedGift[] = [];
/** Whether the gift queue is currently being processed */
const isProcessingGiftQueue = ref(false);

/**
 * Clear the gift queue and reset processing state.
 * Called on room leave to prevent stale gifts from being sent.
 */
export function clearGiftQueue(): void {
  giftQueue.length = 0;
  isProcessingGiftQueue.value = false;
}

// ============================================
// Queue Processor
// ============================================

/**
 * Process the outgoing gift queue sequentially with spacing.
 * This ensures we don't hit server-side rate limits while maintaining
 * smooth optimistic updates on the sender's side.
 */
function processGiftQueue(socket: Ref<AudioSocket | null>) {
  if (isProcessingGiftQueue.value || giftQueue.length === 0) return;

  isProcessingGiftQueue.value = true;

  const processNext = () => {
    // Stop if socket is gone or queue is empty
    if (!socket.value || giftQueue.length === 0) {
      isProcessingGiftQueue.value = false;
      return;
    }

    const gift = giftQueue.shift();
    if (gift) {
      // GF-017: Re-verify seat at emit time (queue delay may make original check stale)
      const seatsStore = useRoomSeatsStore();
      const stillSeated = seatsStore.seats.some(
        (seat) => seat.occupantId === gift.recipientId,
      );
      if (stillSeated) {
        socket.value.emit('gift:send', gift);
      }
    }

    // Schedule next if queue still has items
    if (giftQueue.length > 0) {
      setTimeout(processNext, GIFT_QUEUE_INTERVAL_MS);
    } else {
      isProcessingGiftQueue.value = false;
    }
  };

  processNext();
}

// ============================================
// Composable
// ============================================

export interface UseRoomGiftsParams {
  socket: Ref<AudioSocket | null>;
  getCurrentRoomId: () => string | null;
}

export interface UseRoomGiftsReturn {
  /** Send a gift to a user (queued for rate limiting) */
  sendGift: (giftId: number, recipientId: number, quantity?: number) => void;
  /** Send preload signal to recipients */
  prepareGift: (giftId: number, recipientIds: number[]) => void;
}

/**
 * Gift queue management for room audio.
 * Handles rate-limited gift sending via queue.
 */
export function useRoomGifts({
  socket,
  getCurrentRoomId,
}: UseRoomGiftsParams): UseRoomGiftsReturn {
  /**
   * Send a gift to a user.
   * Pushes to a local queue to be processed with spacing.
   */
  function sendGift(giftId: number, recipientId: number, quantity: number = 1): void {
    const roomId = getCurrentRoomId();
    if (!socket.value || !roomId) return;

    const seatsStore = useRoomSeatsStore();
    const isRecipientSeated = seatsStore.seats.some(
      (seat) => seat.occupantId === recipientId,
    );
    if (!isRecipientSeated) return;

    // Sender-side optimistic accumulation — SINGLE SOURCE. The sender is
    // excluded from the gift:received broadcast, so we mirror what the receiver
    // does in its gift:received handler here (room XP + seat gift value). Callers
    // (send / combo / luckyCombo in useGiftSending) must NOT also accumulate, or
    // the sender double-counts the seat total.
    const roomStore = useRoomStore();
    const { getGiftById } = useGiftData();
    const gift = getGiftById(giftId);
    if (gift && roomStore.currentRoom) {
      const addedXp = gift.price * quantity;
      const currentXp = parseFloat(roomStore.currentRoom.room_xp || '0');
      roomStore.currentRoom.room_xp = (currentXp + addedXp).toString();
      // Seat total reflects the receiver's credited share (lucky → 10%), room XP stays full GCV.
      seatsStore.addSeatGiftValue(recipientId, seatGiftValue(gift, quantity));
    }

    // Push to queue for background processing
    giftQueue.push({
      roomId,
      giftId,
      recipientId,
      quantity,
    });

    // Trigger queue processor
    processGiftQueue(socket);
  }

  /**
   * Send preload signal to recipients.
   * Call when sender selects a gift and recipients.
   */
  function prepareGift(giftId: number, recipientIds: number[]): void {
    const roomId = getCurrentRoomId();
    if (!socket.value || !roomId) return;

    // Send prepare signal for each recipient
    for (const recipientId of recipientIds) {
      socket.value.emit('gift:prepare', {
        roomId,
        giftId,
        recipientId,
      });
    }
  }

  return {
    sendGift,
    prepareGift,
  };
}
