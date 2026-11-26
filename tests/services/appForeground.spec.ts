import { describe, expect, it, vi } from 'vitest'
import { emitAppForeground, onAppForeground } from '~/services/appForeground'

describe('appForeground', () => {
  it('calls every subscriber on emit', () => {
    const a = vi.fn()
    const b = vi.fn()
    const offA = onAppForeground(a)
    const offB = onAppForeground(b)
    emitAppForeground()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    offA()
    offB()
  })

  it('stops calling a subscriber after it unsubscribes', () => {
    const listener = vi.fn()
    const off = onAppForeground(listener)
    off()
    emitAppForeground()
    expect(listener).not.toHaveBeenCalled()
  })

  it('survives a subscriber that unsubscribes itself during the emit', () => {
    const other = vi.fn()
    const off = onAppForeground(() => off())
    const offOther = onAppForeground(other)
    expect(() => emitAppForeground()).not.toThrow()
    expect(other).toHaveBeenCalledTimes(1)
    offOther()
  })
})
