/**
 * Maps machine-readable socket error codes (MSAB `HandlerResult.error`) to
 * user-facing feedback. Mirrors the HTTP join gate's `errors.error_code`
 * mapping (see `normalizeFetchError`) so a blocked user sees the same
 * "blocked from this room" feedback whether the HTTP or the MSAB socket gate
 * caught them (ADR 0017 / room-blocks 03).
 */

/** "blocked for another 2h 15m" / "blocked for another 45s" style suffix. */
export function formatRemainingSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${secs}s`
}

export interface RoomBlockedJoinInfo {
  permanent?: boolean
  remaining_seconds?: number | null
}

/**
 * Resolve a socket `HandlerResult.error` string to display text. Unknown
 * codes (plain English messages from other handlers) pass through unchanged.
 * `room_blocked` carries remaining-time info (from the MSAB Redis mirror's
 * single `TTL` read) so the message matches the HTTP gate's "blocked for
 * another X" feedback.
 */
export function resolveSocketErrorMessage(
  error: string | undefined | null,
  fallback: string,
  info?: RoomBlockedJoinInfo,
): string {
  if (!error) return fallback

  if (error === 'room_blocked') {
    if (info?.permanent) return 'You have been blocked from this room.'
    if (typeof info?.remaining_seconds === 'number') {
      return `You are blocked from this room for another ${formatRemainingSeconds(info.remaining_seconds)}.`
    }
    return 'You have been blocked from this room.'
  }

  return error
}

/** True when the socket error is the room-block gate's machine-readable code. */
export function isRoomBlockedSocketError(error: string | undefined | null): boolean {
  return error === 'room_blocked'
}

/**
 * Thrown when the MSAB socket join gate rejects a blocked user, so callers
 * up the stack (room lifecycle) can distinguish "you may not enter" from a
 * transient audio failure and eject instead of falling back to chat-only.
 */
export class RoomBlockedError extends Error {}

/**
 * Same "blocked for another X" wording, for the HTTP join gate's
 * `meta.remaining_seconds` shape (`number | 'permanent'`) — see
 * `VerifyRoomPasswordAction::rejectIfBlocked`.
 */
export function resolveHttpBlockedMessage(remainingSeconds: number | 'permanent' | undefined | null): string {
  if (remainingSeconds === 'permanent' || remainingSeconds == null) {
    return 'You have been blocked from this room.'
  }
  return `You are blocked from this room for another ${formatRemainingSeconds(remainingSeconds)}.`
}
