// ========================================
// Pretty ID mock backend — seed data
// ========================================
//
// The claimable-ID pools and the fresh state a new user (or a `reset()`) starts
// from: Lv 17, 5,000,000 coins, six live lots with three rival bids, the winners
// ledger and eight weekly allotments.

import { PRETTY_ID_DAY_MS, PRETTY_ID_HOUR_MS } from '~/constants/pretty-id'
import { addLocalDays, weekEndOf } from '~/services/prettyIdMock/clock'
import {
  ARJUN,
  FLY_LIVE,
  KING_ALI,
  LEO_R,
  MIRA,
  NOOR,
  STAR_99,
  ZAYAN,
  rivalAt,
} from '~/services/prettyIdMock/people'
import type { MockPerson } from '~/services/prettyIdMock/people'
import { PRETTY_ID_MOCK_RULES } from '~/services/prettyIdMock/rules'
import { PRETTY_ID_MOCK_VERSION, loadStoredData } from '~/services/prettyIdMock/state'
import type { MockAllotment, MockData, MockLot, MockWin } from '~/services/prettyIdMock/state'
import type { PrettyIdLength } from '~/types/pretty-id'
import { prettyIdMonthKey, prettyIdPreviousMonthKey, prettyIdWeekStart } from '~/utils/pretty-id-format'
import { validatePrettyId } from '~/utils/pretty-id-rules'

// ========================================
// Constants
// ========================================

const MINUTE_MS = 60_000
const DAYS_PER_WEEK = 7

const SEED_LEVEL = 17
const SEED_COINS = 5_000_000
const SEED_LOT_NUMBERS = [7, 8, 9, 66, 88, 99] as const
/** Lot `i` started `SEED_LOT_BASE_AGE_HOURS + i * SEED_LOT_AGE_STEP_HOURS` ago. */
const SEED_LOT_BASE_AGE_HOURS = 6
const SEED_LOT_AGE_STEP_HOURS = 3
const SEED_BID_AGE_HOURS = 2
const SEED_BID_STEP = 100_000
/** The first N seeded wins are "this month"; the rest are earlier. */
const SEED_CURRENT_MONTH_WINS = 3
/** Earlier-month seed rows repeat the first four wins at a lower amount. */
const SEED_EARLIER_ROWS = 4
const SEED_EARLIER_AMOUNT_DROP = 400_000
const SEED_EARLIER_BASE_DAYS_AGO = 35
const SEED_EARLIER_STEP_DAYS = 4
const SEED_BASE_BID_CURRENT = 96_500_000
const SEED_BASE_BID_PREVIOUS = 118_200_000

// ========================================
// Claimable ID pools
// ========================================

const SEED_POOL_6 = [
  '123456', '234567', '345678', '456789', '654321', '765432', '876543', '987654', '520520', '131452',
  '520131', '520888', '168168', '168888', '888168', '666888', '888666', '999888', '520999', '131313',
  '252525', '797979', '123321', '456654', '789987', '135531', '246642', '168861', '112211', '889988',
  '777999', '918918', '606060', '808808', '159951', '357753', '988889', '122221',
]
const SEED_POOL_4 = [
  '1111', '2222', '3333', '5555', '6666', '7777', '8888', '9999', '1234', '2345', '3456', '4567',
  '5678', '6789', '4321', '5432', '6543', '7654', '8765', '9876', '1221', '1331', '2112', '3443',
  '5225', '5200', '1314', '5205', '1688', '8881', '8988', '6969', '1212', '2020', '5656',
]

const NON_ZERO_DIGITS = '123456789'

function repdigits(length: number): string[] {
  return [...NON_ZERO_DIGITS].map(digit => digit.repeat(length))
}

/** The IDs the Choose tab can offer, per length (reserved numbers are filtered out up front). */
export const PRETTY_ID_MOCK_POOLS: Record<PrettyIdLength, readonly string[]> = {
  6: [...new Set([...repdigits(6), ...SEED_POOL_6])].filter(id => validatePrettyId(id, 6) === null),
  4: SEED_POOL_4.filter(id => validatePrettyId(id, 4) === null),
}

// ========================================
// Time helpers
// ========================================

function monthStart(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
}

/**
 * Clamp `raw` into `[start, end]`. Rows `rank` (0 = newest) of `count` keep a minute
 * between them so their order survives the clamp.
 */
function fitInto(raw: number, start: number, end: number, rank: number, count: number): number {
  const lowest = start + (count - 1 - rank) * MINUTE_MS
  const highest = end - rank * MINUTE_MS
  return Math.max(start, Math.min(highest, Math.max(lowest, raw)))
}

// ========================================
// Seed
// ========================================

function seedLots(now: number): MockLot[] {
  return SEED_LOT_NUMBERS.map((number, index) => {
    const ageHours = SEED_LOT_BASE_AGE_HOURS + index * SEED_LOT_AGE_STEP_HOURS
    const hasSeedBid = index % 2 === 0
    return {
      number: String(number),
      starts_at: now - ageHours * PRETTY_ID_HOUR_MS,
      ends_at: now + (PRETTY_ID_MOCK_RULES.auctionDurationHours - ageHours) * PRETTY_ID_HOUR_MS,
      entered: false,
      ended: false,
      bids: hasSeedBid
        ? [{
            user: rivalAt(index).id,
            amount: PRETTY_ID_MOCK_RULES.openingBid + index * SEED_BID_STEP,
            at: now - SEED_BID_AGE_HOURS * PRETTY_ID_HOUR_MS,
          }]
        : [],
      last_rival_roll_at: 0,
    }
  })
}

interface SeedWin {
  person: MockPerson
  number: string
  amount: number
  daysAgo: number
}

const SEED_WINS: readonly SeedWin[] = [
  { person: FLY_LIVE, number: '7', amount: 3_450_000, daysAgo: 2 },
  { person: STAR_99, number: '88', amount: 2_900_000, daysAgo: 4 },
  { person: KING_ALI, number: '9', amount: 5_200_000, daysAgo: 8 },
  { person: MIRA, number: '66', amount: 1_850_000, daysAgo: 12 },
  { person: ZAYAN, number: '1', amount: 6_300_000, daysAgo: 16 },
  { person: LEO_R, number: '99', amount: 1_600_000, daysAgo: 21 },
]

/**
 * Winners ledger. The first three rows are clamped into the current month (never
 * before its 1st); every row's month is later derived from its own timestamp.
 */
function seedWins(now: number): MockWin[] {
  const currentStart = monthStart(now)
  const wins = SEED_WINS.map((win, index): MockWin => {
    const raw = now - win.daysAgo * PRETTY_ID_DAY_MS - index * PRETTY_ID_HOUR_MS
    const isCurrent = index < SEED_CURRENT_MONTH_WINS
    const at = isCurrent ? fitInto(raw, currentStart, now, index, SEED_CURRENT_MONTH_WINS) : raw
    return { user: win.person.id, number: win.number, amount: win.amount, at }
  })
  const earlier = SEED_WINS.slice(0, SEED_EARLIER_ROWS).map((win, index): MockWin => ({
    user: win.person.id,
    number: win.number,
    amount: win.amount - SEED_EARLIER_AMOUNT_DROP,
    at: now - (SEED_EARLIER_BASE_DAYS_AGO + index * SEED_EARLIER_STEP_DAYS) * PRETTY_ID_DAY_MS,
  }))
  return [...wins, ...earlier]
}

const SEED_ALLOTMENTS: ReadonlyArray<readonly [string, MockPerson]> = [
  ['7', FLY_LIVE], ['88', STAR_99], ['9', KING_ALI], ['66', MIRA],
  ['1', ZAYAN], ['99', LEO_R], ['5', NOOR], ['77', ARJUN],
]

/** One allotment per past week, newest first (ids rise with recency). */
function seedAllotments(now: number): MockAllotment[] {
  const thisWeek = prettyIdWeekStart(now)
  return SEED_ALLOTMENTS.map(([number, person], index) => {
    const weekStart = addLocalDays(thisWeek, -(index + 1) * DAYS_PER_WEEK)
    return {
      id: SEED_ALLOTMENTS.length - index,
      user: person.id,
      number,
      week_start: weekStart,
      week_end: weekEndOf(weekStart),
    }
  })
}

/** Fresh mock data for `ownerId`, anchored at `now` (offset 0). */
export function createSeedData(ownerId: number, now: number): MockData {
  const month = prettyIdMonthKey(now)
  return {
    version: PRETTY_ID_MOCK_VERSION,
    owner_id: ownerId,
    level: SEED_LEVEL,
    coins: SEED_COINS,
    offset_hours: 0,
    race_armed: false,
    slots: {},
    holdings: [],
    owned: {
      '888888': KING_ALI.id,
      '520520': MIRA.id,
      '123456': STAR_99.id,
      '666666': ZAYAN.id,
      '168168': NOOR.id,
      '8888': KING_ALI.id,
    },
    released: {},
    lots: seedLots(now),
    wins: seedWins(now),
    allotments: seedAllotments(now),
    bid_log: [],
    base_bid: {
      [month]: SEED_BASE_BID_CURRENT,
      [prettyIdPreviousMonthKey(month)]: SEED_BASE_BID_PREVIOUS,
    },
  }
}

/** Stored data for `ownerId`, or a fresh seed when missing / unreadable / old / someone else's. */
export function loadMockData(ownerId: number): MockData {
  return loadStoredData(ownerId) ?? createSeedData(ownerId, Date.now())
}
