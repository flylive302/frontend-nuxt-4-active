/**
 * Room XP accumulator — folds per-leg gift XP credits into ONE set of store
 * writes per frame.
 *
 * Both the receiver path (`gift:received` in useRoomEventHandlers) and the
 * sender's optimistic path (useRoomGifts.sendGift) credit four reactive
 * values per recipient leg: room XP, daily XP, the drawer period total and
 * the recipient's seat total. In a lucky combo that is hundreds of legs per
 * second, each one re-rendering the room header, info strip and a seat. The
 * sums are identical whether applied per leg or per frame, so the writes are
 * batched here. EXECUTE stage only — no events, no toasts.
 */
import { createFrameCoalescer } from '~/utils/frame-batcher';
import { bumpPeriodTotalXp } from './useRoomGiftLeaderboard';

// ========================================
// Module-Level State
// ========================================

/** Pending XP per recipient for the next flush. */
const pendingBySeat = new Map<number, number>();

/** Pending room-wide XP (sum of every leg) for the next flush. */
let pendingRoomXp = 0;

const coalescer = createFrameCoalescer(flush);

function flush(): void {
  const roomStore = useRoomStore();
  const seatsStore = useRoomSeatsStore();

  if (pendingRoomXp > 0 && roomStore.currentRoom) {
    const currentXp = parseFloat(roomStore.currentRoom.room_xp || '0');
    roomStore.currentRoom.room_xp = (currentXp + pendingRoomXp).toString();
    roomStore.bumpDailyXp(pendingRoomXp);
    bumpPeriodTotalXp(pendingRoomXp);
  }
  for (const [recipientId, xp] of pendingBySeat) {
    seatsStore.addSeatGiftValue(recipientId, xp);
  }
  pendingBySeat.clear();
  pendingRoomXp = 0;
}

// ========================================
// Composable
// ========================================

export function useRoomXpAccumulator() {
  /**
   * Credit one gift leg. Applied to the stores on the next frame together
   * with every other leg credited in the meantime.
   */
  function accumulateGiftXp(recipientId: number, addedXp: number): void {
    if (addedXp <= 0) return;
    pendingRoomXp += addedXp;
    pendingBySeat.set(recipientId, (pendingBySeat.get(recipientId) ?? 0) + addedXp);
    coalescer.schedule();
  }

  /** Apply anything pending right now (tests, room leave). */
  function flushGiftXp(): void {
    coalescer.flushNow();
  }

  return { accumulateGiftXp, flushGiftXp };
}
