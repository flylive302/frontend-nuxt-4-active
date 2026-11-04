// ========================================
// games utils — layout → container, icon URL
// ========================================

import { describe, it, expect } from 'vitest'
import { gameIconUrl, resolveGameContainer } from '~/utils/games'
import {
  GAME_ICON_BASE_PATH,
  GAME_SHEET_MAX_HEIGHT_DVH,
  GAME_SHEET_PANEL_CLASS,
} from '~/constants/games'
import type { GameLayout } from '~/types/room/games'

describe('resolveGameContainer', () => {
  it('renders a full layout in the full-viewport overlay, not a sheet', () => {
    expect(resolveGameContainer('full')).toEqual({ mode: 'overlay' })
  })

  it('renders a half layout in a square sheet panel', () => {
    const container = resolveGameContainer('half')

    expect(container.mode).toBe('sheet')
    expect(container).toMatchObject({ panelClass: expect.stringContaining('aspect-square') })
  })

  it('renders a tall layout in a 2:3 sheet panel', () => {
    const container = resolveGameContainer('tall')

    expect(container.mode).toBe('sheet')
    expect(container).toMatchObject({ panelClass: expect.stringContaining('aspect-[2/3]') })
  })

  it('degrades an unknown layout to the half sheet instead of throwing', () => {
    const container = resolveGameContainer('wide' as GameLayout)

    expect(container).toEqual({ mode: 'sheet', panelClass: GAME_SHEET_PANEL_CLASS.half })
  })

  it('centres and width-caps both sheet panels so a wide screen cannot make them overtall', () => {
    for (const layout of ['half', 'tall'] as const) {
      const container = resolveGameContainer(layout)

      expect(container).toMatchObject({ panelClass: expect.stringContaining('mx-auto w-full max-w-') })
    }
  })
})

describe('sheet panel classes vs GAME_SHEET_MAX_HEIGHT_DVH', () => {
  // The class strings are literals (Tailwind cannot see a built string), so this
  // is the only thing keeping them tied to the constant.
  it('half caps its width at the full height budget (1:1 → height = width)', () => {
    expect(GAME_SHEET_PANEL_CLASS.half).toContain(`max-w-[${GAME_SHEET_MAX_HEIGHT_DVH}dvh]`)
  })

  it('tall caps its width at two thirds of the height budget (2:3 → height = 1.5 × width)', () => {
    expect(GAME_SHEET_PANEL_CLASS.tall).toContain(`max-w-[calc(${GAME_SHEET_MAX_HEIGHT_DVH}dvh*2/3)]`)
  })
})

describe('gameIconUrl', () => {
  it('points at the bundled webp named after the game id', () => {
    expect(gameIconUrl('10')).toBe('/images/games/10.webp')
    expect(gameIconUrl('61')).toBe(`${GAME_ICON_BASE_PATH}/61.webp`)
  })

  it('encodes an id that is not path-safe', () => {
    expect(gameIconUrl('a/b')).toBe('/images/games/a%2Fb.webp')
  })
})
