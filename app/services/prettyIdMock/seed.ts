// ========================================
// Pretty ID mock backend — seed data
// ========================================
//
// The claimable-ID pools and the fresh state a new user starts from: Lv 17,
// nothing claimed, and a handful of IDs already owned by other users.

import { PRETTY_ID_MOCK_VERSION, loadStoredData } from '~/services/prettyIdMock/state'
import type { MockData } from '~/services/prettyIdMock/state'
import type { PrettyIdLength } from '~/types/pretty-id'
import { validatePrettyId } from '~/utils/pretty-id-rules'

// ========================================
// Constants
// ========================================

const SEED_LEVEL = 17

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

/** Fresh mock data for `ownerId`. */
export function createSeedData(ownerId: number): MockData {
  return {
    version: PRETTY_ID_MOCK_VERSION,
    owner_id: ownerId,
    level: SEED_LEVEL,
    slots: {},
    owned: {
      '888888': 'other',
      '520520': 'other',
      '123456': 'other',
      '666666': 'other',
      '168168': 'other',
      '8888': 'other',
    },
  }
}

/** Stored data for `ownerId`, or a fresh seed when missing / unreadable / old / someone else's. */
export function loadMockData(ownerId: number): MockData {
  return loadStoredData(ownerId) ?? createSeedData(ownerId)
}
