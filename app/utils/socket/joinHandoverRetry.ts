import { ROOM_JOIN_HANDOVER_MAX_RETRIES } from '~/constants/room'
import { isRoomHandoverSocketError } from '~/utils/socket/socketErrorMessages'

/**
 * GATE (pure): should a failed `room:join` be retried?
 *
 * keep-watching 20 / room-pin-owner-mismatch: only the machine-readable
 * `room_handover` answer is retryable — it means the join was routed to a
 * server that just lost the room's ownership claim mid instance-refresh, and
 * the owner will have asserted the pin by the time the retry fires. Any other
 * error, and any attempt past `ROOM_JOIN_HANDOVER_MAX_RETRIES`, is final.
 *
 * `attempt` is 0-based: the number of retries already made.
 */
export function shouldRetryJoinAfterHandover(
  error: string | undefined | null,
  attempt: number,
  maxRetries: number = ROOM_JOIN_HANDOVER_MAX_RETRIES,
): boolean {
  if (!isRoomHandoverSocketError(error)) return false
  return attempt < maxRetries
}
