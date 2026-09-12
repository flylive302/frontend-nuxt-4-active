/**
 * room-page-runtime-audit 01 — the broadcast HLS `start()` coalescer.
 *
 * `import.meta.client` is falsy under plain vitest, so `start()` in the HLS
 * player is a no-op here; the guard it relies on is exercised through this pure
 * primitive instead. The wiring (stop() clears the entry, the in-flight run's
 * own stop() keeps it) is browser-verified per the ticket.
 */
import { describe, it, expect, vi } from 'vitest'
import { createKeyedSingleFlight } from '~/utils/keyed-single-flight'

function gate() {
  let open!: () => void
  const opened = new Promise<void>((r) => { open = r })
  return { opened, open }
}

describe('createKeyedSingleFlight', () => {
  it('two concurrent starts with the same key run the work ONCE and share the promise', async () => {
    const g = gate()
    const run = vi.fn(async () => { await g.opened })
    const sf = createKeyedSingleFlight<string>(run)

    const a = sf.start('https://cdn/x.m3u8')
    const b = sf.start('https://cdn/x.m3u8')
    expect(run).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
    expect(sf.inFlightKey()).toBe('https://cdn/x.m3u8')

    g.open()
    await a
    expect(sf.inFlightKey()).toBeNull()
  })

  it('a different key runs immediately (no queueing) and becomes the in-flight key', async () => {
    const g = gate()
    const run = vi.fn(async () => { await g.opened })
    const sf = createKeyedSingleFlight<string>(run)

    void sf.start('a')
    void sf.start('b')
    expect(run).toHaveBeenCalledTimes(2)
    expect(sf.inFlightKey()).toBe('b')
    g.open()
  })

  it('after the run settles, the same key runs again', async () => {
    const run = vi.fn(async () => {})
    const sf = createKeyedSingleFlight<string>(run)
    await sf.start('a')
    await sf.start('a')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('clear() forgets the in-flight run so the same key starts fresh', async () => {
    const gates = [gate(), gate()]
    let call = 0
    const run = vi.fn(async () => { await gates[call++]!.opened })
    const sf = createKeyedSingleFlight<string>(run)

    const first = sf.start('a')
    sf.clear()
    expect(sf.inFlightKey()).toBeNull()
    const second = sf.start('a')
    expect(run).toHaveBeenCalledTimes(2)
    expect(second).not.toBe(first)

    // The stale run finishing must NOT release the newer entry.
    gates[0]!.open()
    await first
    expect(sf.inFlightKey()).toBe('a')
    gates[1]!.open()
    await second
    expect(sf.inFlightKey()).toBeNull()
  })

  it('a rejected run still releases the key', async () => {
    const run = vi.fn(async () => { throw new Error('boom') })
    const sf = createKeyedSingleFlight<string>(run)
    await expect(sf.start('a')).rejects.toThrow('boom')
    expect(sf.inFlightKey()).toBeNull()
  })
})
