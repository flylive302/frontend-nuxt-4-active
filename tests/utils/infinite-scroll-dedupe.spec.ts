import { describe, expect, it } from 'vitest'
import { excludeExistingItems } from '~/utils/infinite-scroll-dedupe'

const item = (id: number | string) => ({ id, name: `room-${id}` })

describe('excludeExistingItems (home-room-feed/09)', () => {
  it('passes a fully fresh page through untouched, in order', () => {
    const incoming = [item(4), item(5), item(6)]
    expect(excludeExistingItems([item(1), item(2), item(3)], incoming)).toEqual(incoming)
  })

  it('drops an id already on screen (room climbed the ranking between pages)', () => {
    const result = excludeExistingItems([item(1), item(2)], [item(2), item(3)])
    expect(result).toEqual([item(3)])
  })

  it('returns empty when every incoming row is already rendered', () => {
    expect(excludeExistingItems([item(1), item(2)], [item(2), item(1)])).toEqual([])
  })

  it('drops duplicates within the incoming page itself, first occurrence wins', () => {
    const result = excludeExistingItems([], [item(7), item(8), item(7)])
    expect(result).toEqual([item(7), item(8)])
  })

  it('handles an empty existing list (page 1)', () => {
    const incoming = [item(1), item(2)]
    expect(excludeExistingItems([], incoming)).toEqual(incoming)
  })

  it('handles an empty incoming page', () => {
    expect(excludeExistingItems([item(1)], [])).toEqual([])
  })

  it('treats string and numeric ids as distinct (no coercion)', () => {
    const result = excludeExistingItems([item(1)], [item('1'), item(2)])
    expect(result).toEqual([item('1'), item(2)])
  })

  it('does not mutate its inputs', () => {
    const existing = [item(1)]
    const incoming = [item(1), item(2)]
    excludeExistingItems(existing, incoming)
    expect(existing).toHaveLength(1)
    expect(incoming).toHaveLength(2)
  })
})
