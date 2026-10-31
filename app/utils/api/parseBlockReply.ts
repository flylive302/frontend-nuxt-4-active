// ========================================
// Parse a "you are blocked" API reply (account-bans 03)
// ========================================
// Pure. Given an HTTP status and response body, return the block it describes,
// or null when the reply is anything else — a plain 401 ("Session ended"), a
// Room Block's 403 `user_blocked`, a malformed body.

import type { BlockErrorCode, BlockInfo } from '~/types/user/block'
import { BLOCK_ERROR_CODES } from '~/constants/blocked'

function isBlockErrorCode(value: unknown): value is BlockErrorCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BLOCK_ERROR_CODES, value)
}

export function parseBlockReply(status: number | undefined, body: unknown): BlockInfo | null {
  // ⛔ 401 only. The Room Block reply is a 403 and must never reach /blocked.
  if (status !== 401) return null
  if (!body || typeof body !== 'object') return null

  const meta = (body as { meta?: unknown }).meta
  if (!meta || typeof meta !== 'object') return null

  const { error_code, reason, blocked_until } = meta as Record<string, unknown>
  if (!isBlockErrorCode(error_code)) return null

  const kind = BLOCK_ERROR_CODES[error_code]

  return {
    kind,
    // IP / device never show a reason, even if one were sent.
    reason: kind === 'account' && typeof reason === 'string' && reason.trim() !== '' ? reason : null,
    until: typeof blocked_until === 'string' && blocked_until !== '' ? blocked_until : null,
  }
}
