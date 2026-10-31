// ========================================
// parseBlockReply Tests (account-bans 03)
// ========================================

import { describe, it, expect } from 'vitest'
import { parseBlockReply } from '~/utils/api/parseBlockReply'

const UNTIL = '2026-11-02T10:00:00+00:00'

function reply(meta: Record<string, unknown>) {
  return { success: false, message: 'Blocked.', meta }
}

describe('parseBlockReply', () => {
  it('ACCOUNT_BLOCKED → account kind with reason and end date', () => {
    expect(parseBlockReply(401, reply({ error_code: 'ACCOUNT_BLOCKED', reason: 'Spam', blocked_until: UNTIL })))
      .toEqual({ kind: 'account', reason: 'Spam', until: UNTIL })
  })

  it('ACCOUNT_BLOCKED, permanent → until null', () => {
    expect(parseBlockReply(401, reply({ error_code: 'ACCOUNT_BLOCKED', reason: 'Spam', blocked_until: null })))
      .toEqual({ kind: 'account', reason: 'Spam', until: null })
  })

  it.each([
    ['IP_BLOCKED', 'ip'],
    ['DEVICE_BLOCKED', 'device'],
  ] as const)('%s → %s kind, never a reason even if one is sent', (code, kind) => {
    expect(parseBlockReply(401, reply({ error_code: code, reason: 'leaked', blocked_until: UNTIL })))
      .toEqual({ kind, reason: null, until: UNTIL })
  })

  it('a plain 401 (no code) is not a block', () => {
    expect(parseBlockReply(401, { success: false, message: 'Unauthenticated.' })).toBeNull()
    expect(parseBlockReply(401, reply({}))).toBeNull()
  })

  it('reads meta only — a code under errors is ignored', () => {
    expect(parseBlockReply(401, { errors: { error_code: 'ACCOUNT_BLOCKED' } })).toBeNull()
  })

  it("a Room Block's 403 user_blocked is never a block screen", () => {
    expect(parseBlockReply(403, reply({ error_code: 'user_blocked' }))).toBeNull()
    expect(parseBlockReply(403, reply({ error_code: 'ACCOUNT_BLOCKED' }))).toBeNull()
  })

  it('unknown codes, missing bodies and junk are not blocks', () => {
    expect(parseBlockReply(401, reply({ error_code: 'SOMETHING_ELSE' }))).toBeNull()
    expect(parseBlockReply(401, reply({ error_code: 'toString' }))).toBeNull()
    expect(parseBlockReply(401, undefined)).toBeNull()
    expect(parseBlockReply(401, 'Unauthorized')).toBeNull()
    expect(parseBlockReply(undefined, reply({ error_code: 'IP_BLOCKED' }))).toBeNull()
  })
})
