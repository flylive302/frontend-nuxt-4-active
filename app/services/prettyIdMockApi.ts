// ========================================
// Pretty ID mock backend — the fake server behind `PrettyIdApi`
// ========================================
//
// Stands in for the Laravel API until it exists (`types/pretty-id.ts` is the
// contract) for the Choose tab: list, search and claim. All state lives in
// localStorage and is the source of truth on EVERY call: load → act → save.
// Nothing is cached in the closure, so two instances can never overwrite each
// other. There are no timers.
//
// This file only wires the pieces in `services/prettyIdMock/`:
//   state   data model + localStorage     seed     pools + fresh state
//   rules   event rules                   mappers  data → response shapes
//   claims  choose / search / claim

import { claimId, listIds, searchId } from '~/services/prettyIdMock/claims'
import { buildMe } from '~/services/prettyIdMock/mappers'
import { loadMockData } from '~/services/prettyIdMock/seed'
import { saveMockData } from '~/services/prettyIdMock/state'
import type { MockCtx } from '~/services/prettyIdMock/state'
import type { PrettyIdApi, PrettyIdMockProfile } from '~/types/pretty-id'

export function createPrettyIdMockApi(profile: PrettyIdMockProfile): PrettyIdApi {
  /** Load → act → save. The save also runs when `act` throws a refusal. */
  function withData<T>(act: (ctx: MockCtx) => T): T {
    const data = loadMockData(profile.id)
    try {
      return act({ data })
    } finally {
      saveMockData(data)
    }
  }

  return {
    me: async () => withData(({ data }) => buildMe(data)),
    list: async query => withData(ctx => listIds(ctx, query)),
    search: async id => withData(ctx => searchId(ctx, id)),
    claim: async id => withData(ctx => claimId(ctx, id)),
  }
}
