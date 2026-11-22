/**
 * The Pretty ID API seam.
 *
 * This file is the ONLY place that knows the mock backend exists. Every other
 * Pretty ID composable talks to `usePrettyIdApi()` and, in the dev panel only,
 * `usePrettyIdMockControls()`.
 *
 * Today both are served by ONE lazily created, module-level mock instance
 * (`services/prettyIdMockApi.ts`, localStorage-backed), seeded with the
 * signed-in user. When the Laravel API lands:
 *  - `usePrettyIdApi` returns a `useApi()`-backed client that maps HTTP error
 *    bodies to `PrettyIdApiError`;
 *  - `usePrettyIdMockControls` returns `null`, which hides the dev panel.
 *
 * Both objects resolve the mock on every call (never at setup), so a caller
 * that kept a reference across a sign-out / sign-in talks to the new user's
 * mock, not the old one's.
 */

import { createPrettyIdMockApi } from '~/services/prettyIdMockApi'
import { useAuthStore } from '~/stores/auth'
import type { PrettyIdApi, PrettyIdMockControls, PrettyIdMockProfile } from '~/types/pretty-id'

const FALLBACK_USER_ID = 0
const FALLBACK_USER_NAME = 'You'

interface MockInstance {
  userId: number
  api: PrettyIdApi
  controls: PrettyIdMockControls
}

let instance: MockInstance | null = null

function currentProfile(): PrettyIdMockProfile {
  const user = useAuthStore().user
  return {
    id: user?.id ?? FALLBACK_USER_ID,
    name: user?.name ?? FALLBACK_USER_NAME,
    avatar_url: user?.avatar ?? null,
  }
}

/** The mock for the signed-in user; rebuilt when the user id changes. */
function mock(): MockInstance {
  const profile = currentProfile()
  if (instance === null || instance.userId !== profile.id) {
    instance = { userId: profile.id, ...createPrettyIdMockApi(profile) }
  }
  return instance
}

const api: PrettyIdApi = {
  me: () => mock().api.me(),
  list: query => mock().api.list(query),
  search: id => mock().api.search(id),
  claim: id => mock().api.claim(id),
  change: (id, slot) => mock().api.change(id, slot),
  auctions: () => mock().api.auctions(),
  auction: lotId => mock().api.auction(lotId),
  enter: lotId => mock().api.enter(lotId),
  bid: (lotId, amount) => mock().api.bid(lotId, amount),
  winners: month => mock().api.winners(month),
  weekly: () => mock().api.weekly(),
}

const controls: PrettyIdMockControls = {
  state: () => mock().controls.state(),
  setLevel: level => mock().controls.setLevel(level),
  addCoins: amount => mock().controls.addCoins(amount),
  skipHours: hours => mock().controls.skipHours(hours),
  rivalBidsNow: () => mock().controls.rivalBidsNow(),
  endAllAuctions: () => mock().controls.endAllAuctions(),
  toggleRace: () => mock().controls.toggleRace(),
  addChangeToken: () => mock().controls.addChangeToken(),
  reset: () => mock().controls.reset(),
}

export function usePrettyIdApi(): PrettyIdApi {
  return api
}

/** `null` once the real API is wired — the dev panel hides itself on `null`. */
export function usePrettyIdMockControls(): PrettyIdMockControls | null {
  return controls
}
