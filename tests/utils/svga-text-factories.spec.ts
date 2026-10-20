import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildSvgaTextFactories, type SvgaSlotTextStyle } from '~/utils/svga-text-canvas'

const style: SvgaSlotTextStyle = {
  color: '#fff',
  fontFamily: 'sans-serif',
  fontWeight: '700',
  minFontSize: 8,
  maxFontSize: 40,
  slotRatio: 0.5,
  maxLines: 2,
  lineHeight: 1.2,
  paddingX: 4,
}

interface FakeCanvas {
  width: number
  height: number
  getContext: () => unknown
}

function stubDocument(withContext: boolean): void {
  const ctx = {
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
    measureText: (t: string) => ({ width: t.length * 5 }),
    fillText: vi.fn(),
  }
  vi.stubGlobal('document', {
    createElement: (): FakeCanvas => ({ width: 0, height: 0, getContext: () => (withContext ? ctx : null) }),
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('buildSvgaTextFactories', () => {
  it('returns undefined when all texts are blank', () => {
    expect(buildSvgaTextFactories({ a: '', b: null, c: undefined }, style)).toBeUndefined()
  })

  it('returns one factory per non-blank key', () => {
    const out = buildSvgaTextFactories({ a: 'Lia', b: '', c: 'Ravi' }, style)
    expect(Object.keys(out ?? {})).toEqual(['a', 'c'])
  })

  it('factory returns a canvas of exactly the requested size', () => {
    stubDocument(true)
    const canvas = buildSvgaTextFactories({ a: 'Lia' }, style)?.a?.(120, 40)
    expect(canvas?.width).toBe(120)
    expect(canvas?.height).toBe(40)
  })

  it('factory returns null when no 2D context is available', () => {
    stubDocument(false)
    expect(buildSvgaTextFactories({ a: 'Lia' }, style)?.a?.(120, 40)).toBeNull()
  })
})
