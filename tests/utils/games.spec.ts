// ========================================
// games utils — layout → container, icon URL, origin, placement
// ========================================

import { describe, it, expect } from 'vitest'
import {
  gameIconUrl,
  isGameOfferedIn,
  normalizeGameOrigin,
  resolveFlyGameTarget,
  resolveGameContainer,
} from '~/utils/games'
import {
  GAME_ICON_BASE_PATH,
  GAME_SHEET_MAX_HEIGHT_DVH,
  GAME_SHEET_PANEL_CLASS,
} from '~/constants/games'
import type { GameCatalogEntry, GameLayout } from '~/types/room/games'

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

describe('normalizeGameOrigin', () => {
  it('keeps a bare origin as is, with or without a trailing slash', () => {
    expect(normalizeGameOrigin('https://flylive-ludo.flylive.workers.dev')).toBe('https://flylive-ludo.flylive.workers.dev')
    expect(normalizeGameOrigin('https://flylive-ludo.flylive.workers.dev/')).toBe('https://flylive-ludo.flylive.workers.dev')
    expect(normalizeGameOrigin('http://192.168.1.5:5175')).toBe('http://192.168.1.5:5175')
  })

  it.each([
    ['empty', ''],
    ['null', null],
    ['undefined', undefined],
    ['not a URL', 'flylive-ludo'],
    ['a path', 'https://a.example/game'],
    ['a query', 'https://a.example/?token=x'],
    ['a fragment', 'https://a.example/#x'],
    ['credentials', 'https://user:pw@a.example'],
    ['a default port written out', 'https://a.example:443'],
    ['a non-http scheme', 'javascript:alert(1)'],
  ])('refuses %s', (_label, input) => {
    expect(normalizeGameOrigin(input)).toBeNull()
  })
})

/** `launch_url` values that must never load: each is one thing a browser would rewrite or a parser would misread. */
const REFUSED_LAUNCH_URLS: ReadonlyArray<[label: string, value: string]> = [
  ['empty', ''],
  ['not a URL', 'not a url'],
  ['a javascript: URL', 'javascript:alert(1)'],
  ['a non-http scheme', 'ftp://host/carrom'],
  ['a trailing slash on a path', 'https://host/carrom/'],
  ['an empty path segment', 'https://host//carrom'],
  ['a `..` segment', 'https://host/carrom/../x'],
  ['a `.` segment', 'https://host/./carrom'],
  ['a query', 'https://host/carrom?x=1'],
  ['a fragment', 'https://host/carrom#x'],
  ['credentials', 'https://user:pw@host/carrom'],
  ['a default port written out', 'https://host:443/carrom'],
  ['an uppercase host', 'https://HOST/carrom'],
  ['an encoded slash', 'https://host/car%2Fom'],
  ['a backslash', 'https://host\\carrom'],
  ['a space', 'https://host/carrom play'],
  ['a non-string', 123 as unknown as string],
]

describe('resolveFlyGameTarget', () => {
  const HOST = 'https://host'

  describe('a row with no `launch_url` (a backend from before it)', () => {
    it.each([
      ['absent', undefined],
      ['null', null],
    ])('falls back to the bare origin when `launch_url` is %s', (_label, launchUrl) => {
      expect(resolveFlyGameTarget({ origin: HOST, launch_url: launchUrl }))
        .toEqual({ origin: HOST, url: HOST })
      expect(resolveFlyGameTarget({ origin: `${HOST}/`, launch_url: launchUrl }))
        .toEqual({ origin: HOST, url: HOST })
    })

    it('reads a row with only an `origin` key (the field is not there at all)', () => {
      expect(resolveFlyGameTarget({ origin: HOST })).toEqual({ origin: HOST, url: HOST })
    })

    it.each([
      ['no origin at all', {}],
      ['a null origin', { origin: null }],
      ['an empty origin', { origin: '' }],
      ['an origin with a path', { origin: `${HOST}/carrom` }],
      ['an origin that is not a URL', { origin: 'flylive-ludo' }],
      ['null for both', { origin: null, launch_url: null }],
    ])('is null with %s', (_label, row) => {
      expect(resolveFlyGameTarget(row)).toBeNull()
    })
  })

  describe('a row with a usable `launch_url`', () => {
    it('Ludo shape (origin + the same launch_url): the url is the bare origin', () => {
      expect(resolveFlyGameTarget({ origin: HOST, launch_url: HOST }))
        .toEqual({ origin: HOST, url: HOST })
    })

    it('Carrom shape (null origin, launch_url on a path): bare origin for the GATE, the full URL for the frame', () => {
      expect(resolveFlyGameTarget({ origin: null, launch_url: `${HOST}/carrom` }))
        .toEqual({ origin: HOST, url: `${HOST}/carrom` })
    })

    it('does not need the `origin` key at all', () => {
      expect(resolveFlyGameTarget({ launch_url: `${HOST}/carrom` }))
        .toEqual({ origin: HOST, url: `${HOST}/carrom` })
    })

    it('accepts a nested path', () => {
      expect(resolveFlyGameTarget({ origin: null, launch_url: `${HOST}/games/carrom` }))
        .toEqual({ origin: HOST, url: `${HOST}/games/carrom` })
    })

    it('accepts every character a path segment may carry', () => {
      expect(resolveFlyGameTarget({ origin: null, launch_url: `${HOST}/a-b_c.d~E9/v1.2` }))
        .toEqual({ origin: HOST, url: `${HOST}/a-b_c.d~E9/v1.2` })
    })

    it('keeps a non-default port in both the origin and the url', () => {
      expect(resolveFlyGameTarget({ origin: null, launch_url: 'http://192.168.1.5:5175/carrom' }))
        .toEqual({ origin: 'http://192.168.1.5:5175', url: 'http://192.168.1.5:5175/carrom' })
    })

    it('turns a bare-origin launch_url with one trailing slash into the bare origin', () => {
      expect(resolveFlyGameTarget({ origin: null, launch_url: `${HOST}/` }))
        .toEqual({ origin: HOST, url: HOST })
      expect(resolveFlyGameTarget({ origin: HOST, launch_url: `${HOST}/` }))
        .toEqual({ origin: HOST, url: HOST })
    })

    it('accepts a row `origin` that normalises to the same origin as the launch_url', () => {
      expect(resolveFlyGameTarget({ origin: `${HOST}/`, launch_url: `${HOST}/carrom` }))
        .toEqual({ origin: HOST, url: `${HOST}/carrom` })
    })
  })

  describe('a row whose `origin` and `launch_url` disagree', () => {
    it.each([
      ['another host', 'https://other'],
      ['another port', 'https://host:8443'],
      ['another scheme', 'http://host'],
    ])('is null when the row origin is %s', (_label, origin) => {
      expect(resolveFlyGameTarget({ origin, launch_url: `${HOST}/carrom` })).toBeNull()
      expect(resolveFlyGameTarget({ origin, launch_url: HOST })).toBeNull()
    })

    it('is null when the row origin is itself unusable, even though the launch_url is fine', () => {
      expect(resolveFlyGameTarget({ origin: `${HOST}/carrom`, launch_url: `${HOST}/carrom` })).toBeNull()
      expect(resolveFlyGameTarget({ origin: '', launch_url: `${HOST}/carrom` })).toBeNull()
    })
  })

  describe('a present but unusable `launch_url`', () => {
    it.each(REFUSED_LAUNCH_URLS)('refuses %s', (_label, launchUrl) => {
      expect(resolveFlyGameTarget({ origin: null, launch_url: launchUrl })).toBeNull()
    })

    it.each(REFUSED_LAUNCH_URLS)('refuses %s even with a perfectly valid `origin` — it never falls back', (_label, launchUrl) => {
      // The origin root can be a different game (Ludo, for Carrom): loading it
      // would put the wrong game in front of the player.
      expect(resolveFlyGameTarget({ origin: HOST, launch_url: launchUrl })).toBeNull()
    })
  })
})

describe('isGameOfferedIn', () => {
  const JOYPLAY: GameCatalogEntry = { game_id: '10', name: 'Roulette', category: 'Casino', layout: 'half', provider: 'joyplay', places: ['room_lobby'], origin: null }
  const LUDO: GameCatalogEntry = {
    game_id: 'fly-ludo', name: 'Ludo', category: 'Casual', layout: 'full',
    provider: 'fly', places: ['room_lobby', 'games_page'], origin: 'https://flylive-ludo.flylive.workers.dev',
  }

  it('offers a game where its places say', () => {
    expect(isGameOfferedIn(JOYPLAY, 'room_lobby')).toBe(true)
    expect(isGameOfferedIn(JOYPLAY, 'games_page')).toBe(false)
    expect(isGameOfferedIn(LUDO, 'room_lobby')).toBe(true)
    expect(isGameOfferedIn(LUDO, 'games_page')).toBe(true)
  })

  it('offers a row from a pre-fly-games backend (no provider, no places) in the Room lobby only', () => {
    const legacy: GameCatalogEntry = { game_id: '10', name: 'Roulette', category: 'Casino', layout: 'half' }
    expect(isGameOfferedIn(legacy, 'room_lobby')).toBe(true)
    expect(isGameOfferedIn(legacy, 'games_page')).toBe(false)
  })

  it('never offers an unknown provider', () => {
    expect(isGameOfferedIn({ ...JOYPLAY, provider: 'someone-else' }, 'room_lobby')).toBe(false)
  })

  it('never offers a Fly game without places or a usable origin', () => {
    expect(isGameOfferedIn({ ...LUDO, places: undefined }, 'room_lobby')).toBe(false)
    expect(isGameOfferedIn({ ...LUDO, origin: null }, 'room_lobby')).toBe(false)
    expect(isGameOfferedIn({ ...LUDO, origin: 'https://a.example/path' }, 'room_lobby')).toBe(false)
  })

  describe('a Fly game on a path (Carrom)', () => {
    const CARROM: GameCatalogEntry = {
      game_id: 'fly-carrom', name: 'Carrom', category: 'Casual', layout: 'full',
      provider: 'fly', places: ['room_lobby', 'games_page'], origin: null,
      launch_url: 'https://flylive-ludo.flylive.workers.dev/carrom',
    }

    it('is offered in the places it names, via its launch_url alone', () => {
      expect(isGameOfferedIn(CARROM, 'room_lobby')).toBe(true)
      expect(isGameOfferedIn(CARROM, 'games_page')).toBe(true)
      expect(isGameOfferedIn({ ...CARROM, places: ['games_page'] }, 'room_lobby')).toBe(false)
      expect(isGameOfferedIn({ ...CARROM, places: undefined }, 'games_page')).toBe(false)
    })

    it('is not offered when its launch_url is unusable, even with a valid origin', () => {
      expect(isGameOfferedIn({ ...CARROM, launch_url: 'https://flylive-ludo.flylive.workers.dev/carrom/' }, 'games_page')).toBe(false)
      expect(isGameOfferedIn({ ...CARROM, launch_url: 'javascript:alert(1)' }, 'room_lobby')).toBe(false)
      expect(isGameOfferedIn({ ...CARROM, origin: 'https://flylive-ludo.flylive.workers.dev', launch_url: 'not a url' }, 'games_page')).toBe(false)
    })

    it('is not offered when its launch_url is on a different origin than the row origin', () => {
      expect(isGameOfferedIn({ ...CARROM, origin: 'https://other.example' }, 'games_page')).toBe(false)
    })

    it('still offers a Ludo row that also carries a launch_url on its own origin', () => {
      expect(isGameOfferedIn({ ...LUDO, launch_url: LUDO.origin }, 'games_page')).toBe(true)
    })

    it('is hidden from an older bundle because a null origin normalises to nothing (why the backend may send `origin: null`)', () => {
      // An older bundle reads `origin` only, through this function.
      expect(normalizeGameOrigin(CARROM.origin)).toBeNull()
    })
  })
})
