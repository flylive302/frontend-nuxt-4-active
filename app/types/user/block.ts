// ========================================
// Block state (account-bans 03)
// ========================================
// The app-side shape of PRD §4's "you are blocked" reply. The backend sends
// HTTP 401 with `meta.error_code` ∈ BLOCK_ERROR_CODES, `meta.reason` (account
// only; always null for IP / device) and `meta.blocked_until` (ISO 8601, null =
// permanent). Persisted in the auth store so /blocked survives a kill + relaunch.

/** `meta.error_code` values of the blocked reply (BLOCK_ERROR_CODES maps them to kinds). */
export type BlockErrorCode = 'ACCOUNT_BLOCKED' | 'IP_BLOCKED' | 'DEVICE_BLOCKED'

export type BlockKind = 'account' | 'ip' | 'device'

export interface BlockInfo {
  kind: BlockKind
  /** Account blocks only. IP / device blocks never carry a reason. */
  reason: string | null
  /** ISO 8601 end of the block; null = permanent. */
  until: string | null
}
