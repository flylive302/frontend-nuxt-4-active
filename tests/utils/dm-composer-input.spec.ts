/**
 * dm-composer-input (dm-messenger-v2/08) — mic <-> send morph and
 * Enter/Shift+Enter keydown decisions for the composer bar.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveComposerMorphMode,
  isComposerTextSendable,
  shouldSendOnKeydown,
} from '../../app/utils/dm-composer-input'

describe('deriveComposerMorphMode', () => {
  it('shows mic when text is empty', () => {
    expect(deriveComposerMorphMode('')).toBe('mic')
  })

  it('shows mic when text is whitespace-only', () => {
    expect(deriveComposerMorphMode('   \n  ')).toBe('mic')
  })

  it('shows send once real text is present', () => {
    expect(deriveComposerMorphMode('hi')).toBe('send')
  })

  it('shows send for text surrounded by whitespace', () => {
    expect(deriveComposerMorphMode('  hi  ')).toBe('send')
  })
})

describe('isComposerTextSendable', () => {
  it('is false for empty string', () => {
    expect(isComposerTextSendable('')).toBe(false)
  })

  it('is false for whitespace-only string', () => {
    expect(isComposerTextSendable('   ')).toBe(false)
  })

  it('is true once non-whitespace text is present', () => {
    expect(isComposerTextSendable('hello')).toBe(true)
  })
})

describe('shouldSendOnKeydown', () => {
  it('sends on Enter without Shift', () => {
    expect(shouldSendOnKeydown('Enter', false)).toBe(true)
  })

  it('does not send on Shift+Enter (newline insert)', () => {
    expect(shouldSendOnKeydown('Enter', true)).toBe(false)
  })

  it('does not send on other keys', () => {
    expect(shouldSendOnKeydown('a', false)).toBe(false)
    expect(shouldSendOnKeydown('Tab', false)).toBe(false)
  })
})
