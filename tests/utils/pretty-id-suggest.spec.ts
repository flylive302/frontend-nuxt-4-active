// ========================================
// Pretty ID similar-ID suggester tests
// ========================================

import { describe, it, expect } from 'vitest'
import { classifyPrettyId, prettyIdShape, validatePrettyId } from '~/utils/pretty-id-rules'
import { suggestPrettyIds } from '~/utils/pretty-id-suggest'

describe('suggestPrettyIds', () => {
  const taken = '888888'
  const everythingButTarget = (id: string): boolean => id !== taken

  it('suggests same-shape IDs first for a taken repdigit', () => {
    const suggestions = suggestPrettyIds(taken, everythingButTarget, 6)
    expect(suggestions).toHaveLength(6)
    for (const { id } of suggestions) {
      expect(prettyIdShape(id)).toBe('AAAAAA')
    }
  })

  it('never returns the target, a reserved number or an invalid ID', () => {
    const suggestions = suggestPrettyIds(taken, () => true, 50)
    expect(suggestions.length).toBeGreaterThan(0)
    for (const { id } of suggestions) {
      expect(id).not.toBe(taken)
      expect(validatePrettyId(id, taken.length)).toBeNull()
    }
    expect(suggestions.map(s => s.id)).not.toContain('444444')
    expect(suggestions.map(s => s.id)).not.toContain('000000')
  })

  it('respects the availability callback', () => {
    const blocked = new Set(['111111', '222222', '333333'])
    const suggestions = suggestPrettyIds(taken, id => id !== taken && !blocked.has(id), 50)
    for (const { id } of suggestions) {
      expect(blocked.has(id)).toBe(false)
    }
  })

  it('respects the limit, and a limit of zero yields nothing', () => {
    expect(suggestPrettyIds(taken, () => true, 3)).toHaveLength(3)
    expect(suggestPrettyIds(taken, () => true, 1)).toHaveLength(1)
    expect(suggestPrettyIds(taken, () => true, 0)).toEqual([])
  })

  it('labels each suggestion with its own tier', () => {
    for (const { id, tier } of suggestPrettyIds(taken, () => true, 20)) {
      expect(tier).toBe(classifyPrettyId(id))
    }
  })

  it('is deterministic and best-first', () => {
    const first = suggestPrettyIds(taken, () => true, 10)
    const second = suggestPrettyIds(taken, () => true, 10)
    expect(second).toEqual(first)
    // Ties on score break by ascending ID: the repdigits come out in order.
    const repdigits = first.filter(s => prettyIdShape(s.id) === 'AAAAAA').map(s => s.id)
    expect(repdigits).toEqual([...repdigits].sort())
  })

  it('offers sequences for a taken sequence', () => {
    const suggestions = suggestPrettyIds('123456', id => id !== '123456', 4)
    expect(suggestions.length).toBeGreaterThan(0)
    expect(suggestions[0]?.tier).toBe('sequence')
  })

  it('works for 4-digit targets', () => {
    const suggestions = suggestPrettyIds('8888', id => id !== '8888', 6)
    expect(suggestions).toHaveLength(6)
    for (const { id } of suggestions) {
      expect(id).toHaveLength(4)
    }
  })
})
