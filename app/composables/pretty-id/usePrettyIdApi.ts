/**
 * The Pretty ID API seam.
 *
 * This file is the ONLY place that knows the mock backend exists. Every other
 * Pretty ID composable talks to `usePrettyIdApi()`.
 *
 * Today it is served by ONE lazily created, module-level mock instance
 * (`services/prettyIdMockApi.ts`, localStorage-backed), seeded for the
 * signed-in user. When the Laravel API lands, `usePrettyIdApi` returns a
 * `useApi()`-backed client that maps HTTP error bodies to `PrettyIdApiError`.
 *
 * The returned object resolves the mock on every call (never at setup), so a
 * caller that kept a reference across a sign-out / sign-in talks to the new
 * user's mock, not the old one's.
 */

import { createPrettyIdMockApi } from '~/services/prettyIdMockApi'
import { useAuthStore } from '~/stores/auth'
import type { PrettyIdApi, PrettyIdMockProfile } from '~/types/pretty-id'

const FALLBACK_USER_ID = 0

interface MockInstance {
  userId: number
  api: PrettyIdApi
}

let instance: MockInstance | null = null

function currentProfile(): PrettyIdMockProfile {
  return { id: useAuthStore().user?.id ?? FALLBACK_USER_ID }
}

/** The mock for the signed-in user; rebuilt when the user id changes. */
function mock(): MockInstance {
  const profile = currentProfile()
  if (instance === null || instance.userId !== profile.id) {
    instance = { userId: profile.id, api: createPrettyIdMockApi(profile) }
  }
  return instance
}

const api: PrettyIdApi = {
  me: () => mock().api.me(),
  list: query => mock().api.list(query),
  search: id => mock().api.search(id),
  claim: id => mock().api.claim(id),
}

export function usePrettyIdApi(): PrettyIdApi {
  return api
}
