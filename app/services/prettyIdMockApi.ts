// ========================================
// Pretty ID mock backend — the fake server behind `PrettyIdApi`
// ========================================
//
// Stands in for the Laravel API until it exists (`types/pretty-id.ts` is the
// contract). All state lives in localStorage and is the source of truth on EVERY
// call: load → housekeeping → act → save. Nothing is cached in the closure, so two
// instances can never overwrite each other.
//
// There are no timers. The demo's 1 s `tick` is replaced by housekeeping at the
// start of each call (lots settle, holdings expire), and its 7 s rival-bid
// interval by a throttled dice roll inside `auction()`.
//
// This file only wires the pieces in `services/prettyIdMock/`:
//   state       data model + localStorage          seed        pools + fresh state
//   rules       event rules                        people      fictional users
//   clock       mock clock                         mappers     data → response shapes
//   housekeeping settlement + expiry               claims      choose / search / claim / change
//   auctions    enter / bid / winners / weekly     rivals      bot bids

import { PRETTY_ID_SLOT_KEYS } from '~/constants/pretty-id'
import { enterLot, findLot, placeBid, weeklyFor, winnersFor } from '~/services/prettyIdMock/auctions'
import { claimOrChange, listIds, searchId } from '~/services/prettyIdMock/claims'
import { mockNow } from '~/services/prettyIdMock/clock'
import { runHousekeeping } from '~/services/prettyIdMock/housekeeping'
import { buildLot, buildMe } from '~/services/prettyIdMock/mappers'
import { rollRivalBots, tryRivalBid } from '~/services/prettyIdMock/rivals'
import { createSeedData, loadMockData } from '~/services/prettyIdMock/seed'
import { saveMockData } from '~/services/prettyIdMock/state'
import type { MockCtx } from '~/services/prettyIdMock/state'
import type {
  PrettyIdApi,
  PrettyIdLot,
  PrettyIdMockControls,
  PrettyIdMockProfile,
} from '~/types/pretty-id'

export { PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMock/rules'

export interface PrettyIdMockOptions {
  /** Random source for the rival bots; defaults to `Math.random`. Tests inject a scripted one. */
  random?: () => number
}

export function createPrettyIdMockApi(
  profile: PrettyIdMockProfile,
  options: PrettyIdMockOptions = {},
): { api: PrettyIdApi, controls: PrettyIdMockControls } {
  const random = options.random ?? Math.random

  /** Load → housekeeping → act → save. The save also runs when `act` throws a refusal. */
  function withData<T>(act: (ctx: MockCtx) => T): T {
    const data = loadMockData(profile.id)
    const now = mockNow(data)
    runHousekeeping(data, now)
    try {
      return act({ data, now })
    } finally {
      saveMockData(data)
    }
  }

  const api: PrettyIdApi = {
    me: async () => withData(({ data, now }) => buildMe(data, profile, now)),
    list: async query => withData(ctx => listIds(ctx, query)),
    search: async id => withData(ctx => searchId(ctx, id)),
    claim: async id => withData(ctx => claimOrChange(ctx, profile, id, null)),
    change: async (id, slot) => withData(ctx => claimOrChange(ctx, profile, id, slot)),
    auctions: async () => withData(({ data }): PrettyIdLot[] => data.lots.map(lot => buildLot(lot, profile))),
    auction: async lotId => withData((ctx) => {
      const lot = findLot(ctx, lotId)
      rollRivalBots(ctx, lot, random)
      return buildLot(lot, profile)
    }),
    enter: async lotId => withData(ctx => enterLot(ctx, profile, lotId)),
    bid: async (lotId, amount) => withData(ctx => placeBid(ctx, profile, lotId, amount)),
    winners: async month => withData(ctx => winnersFor(ctx, profile, month)),
    weekly: async () => withData(ctx => weeklyFor(ctx, profile)),
  }

  const controls: PrettyIdMockControls = {
    state: () => {
      const data = loadMockData(profile.id)
      return {
        level: data.level,
        coins: data.coins,
        offset_hours: data.offset_hours,
        race_armed: data.race_armed,
      }
    },
    setLevel: (level) => {
      withData(({ data }) => { data.level = level })
    },
    addCoins: (amount) => {
      withData(({ data }) => { data.coins = amount === 0 ? 0 : data.coins + amount })
    },
    skipHours: (hours) => {
      // Housekeeping at the new time runs on the next call; this one only moves the clock.
      withData(({ data }) => { data.offset_hours += hours })
    },
    rivalBidsNow: () => withData(ctx => ctx.data.lots.filter(lot => tryRivalBid(ctx, lot, random)).length),
    endAllAuctions: () => {
      withData((ctx) => {
        for (const lot of ctx.data.lots) {
          if (!lot.ended) lot.ends_at = ctx.now
        }
        runHousekeeping(ctx.data, ctx.now)
      })
    },
    toggleRace: () => {
      withData(({ data }) => { data.race_armed = !data.race_armed })
    },
    addChangeToken: () => withData(({ data }) => {
      let claimed = 0
      for (const key of PRETTY_ID_SLOT_KEYS) {
        const slot = data.slots[key]
        if (!slot) continue
        slot.tokens += 1
        claimed += 1
      }
      return claimed > 0
    }),
    reset: () => {
      saveMockData(createSeedData(profile.id, Date.now()))
    },
  }

  return { api, controls }
}
