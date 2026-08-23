/**
 * Room Gifts Composable
 *
 * Handles gift sending as a single burst emit (one `gift:send` covers every
 * recipient of a send/combo press) and returns the server ack so callers can
 * reconcile the optimistic debit against `acceptedRecipientIds`.
 */
import type { Ref } from 'vue';
import type { AudioSocket, GiftSendAck } from '~/types/room/audio';
import { createEmitAsync } from '~/utils/socket';
import { useRoomXpAccumulator } from './useRoomXpAccumulator';

// ============================================
// Composable
// ============================================

export interface UseRoomGiftsParams {
  socket: Ref<AudioSocket | null>;
  getCurrentRoomId: () => string | null;
}

export interface UseRoomGiftsReturn {
  /** Send a gift burst to every seated recipient; resolves with the server ack. */
  sendGift: (
    giftId: number,
    recipientIds: number[],
    quantity?: number,
    batchId?: string,
  ) => Promise<GiftSendAck | null>;
  /** Send preload signal to recipients */
  prepareGift: (giftId: number, recipientIds: number[]) => void;
}

/**
 * Gift sending for room audio: one burst emit per send/combo press.
 */
export function useRoomGifts({
  socket,
  getCurrentRoomId,
}: UseRoomGiftsParams): UseRoomGiftsReturn {
  const emitAsync = createEmitAsync(socket);
  const { accumulateGiftXp } = useRoomXpAccumulator();

  /**
   * Send a gift to every currently-seated recipient in one burst emit.
   * GATE: only seated recipients are booked/sent. EXECUTE: single emit with
   * ack. REACT (sender-side optimistic accumulation) runs for every seated
   * recipient before the emit resolves.
   */
  async function sendGift(
    giftId: number,
    recipientIds: number[],
    quantity: number = 1,
    batchId?: string,
  ): Promise<GiftSendAck | null> {
    const roomId = getCurrentRoomId();
    if (!socket.value || !roomId) return null;

    const seatsStore = useRoomSeatsStore();
    const seatedRecipientIds = recipientIds.filter((recipientId) =>
      seatsStore.seats.some((seat) => seat.occupantId === recipientId),
    );
    if (seatedRecipientIds.length === 0) return null;

    // Sender-side optimistic accumulation — SINGLE SOURCE. The sender is
    // excluded from the gift:received broadcast, so we mirror what the receiver
    // does in its gift:received handler here (room XP + seat gift value). Callers
    // (send / combo / luckyCombo in useGiftSending) must NOT also accumulate, or
    // the sender double-counts the seat total.
    const roomStore = useRoomStore();
    const { getGiftById } = useGiftData();
    const gift = getGiftById(giftId);
    if (gift && roomStore.currentRoom) {
      const addedXpPerRecipient = seatGiftValue(gift, quantity);
      for (const recipientId of seatedRecipientIds) {
        // Room XP credits the same split base the backend books as `xpBase`
        // (normal → full GCV, lucky → floor(GCV × LUCKY_SPLIT_SHARE)), which is
        // exactly what seatGiftValue returns. Using the full GCV here over-counts
        // lucky sends and drifts the sender's bar ahead of the receiver's (and the
        // authoritative value) until a refetch. Writes are batched per frame
        // (room XP, daily XP, period total, seat total) by useRoomXpAccumulator.
        accumulateGiftXp(recipientId, addedXpPerRecipient);
      }
    }

    // Single burst emit for every seated recipient; resolves with the ack.
    try {
      return await emitAsync<
        { roomId: string; giftId: number; recipientIds: number[]; quantity: number; batchId?: string },
        GiftSendAck
      >('gift:send', { roomId, giftId, recipientIds: seatedRecipientIds, quantity, batchId });
    } catch {
      return null;
    }
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
