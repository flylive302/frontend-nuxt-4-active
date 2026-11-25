import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePrettyIdConfetti } from '~/composables/pretty-id/usePrettyIdConfetti'

const confettiMock = vi.fn()

vi.mock('canvas-confetti', () => ({ default: (...args: unknown[]) => confettiMock(...args) }))
vi.mock('~/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}))

function stubReducedMotion(reduced: boolean): void {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reduced }) })
}

describe('usePrettyIdConfetti', () => {
  beforeEach(() => {
    confettiMock.mockReset()
    confettiMock.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fires one burst', async () => {
    stubReducedMotion(false)
    await usePrettyIdConfetti().fireConfetti()
    expect(confettiMock).toHaveBeenCalledTimes(1)
  })

  it('fires nothing under prefers-reduced-motion', async () => {
    stubReducedMotion(true)
    await usePrettyIdConfetti().fireConfetti()
    expect(confettiMock).not.toHaveBeenCalled()
  })

  it('swallows a failing burst', async () => {
    stubReducedMotion(false)
    confettiMock.mockRejectedValue(new Error('canvas gone'))
    await expect(usePrettyIdConfetti().fireConfetti()).resolves.toBeUndefined()
  })
})
