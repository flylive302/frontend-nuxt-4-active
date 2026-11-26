/**
 * Wires the Rare ID win celebration check into the app's lifetime. Called once
 * from the global shell, like `useRoomLifecycle`.
 *
 * Runs `checkUnseenWins` on app open, after a login, when the Pretty ID switches
 * turn on (bootstrap may answer after mount) and on every app foreground. The
 * check itself makes no request while a switch is off and never shows the same
 * win twice, so over-triggering is harmless.
 */

import { onScopeDispose, watch } from 'vue'
import { usePrettyIdUnseenWins } from '~/composables/pretty-id/usePrettyIdUnseenWins'
import { onAppForeground } from '~/services/appForeground'
import { useAuthStore } from '~/stores/auth'
import { useBootstrapStore } from '~/stores/bootstrap'

export function usePrettyIdUnseenWinsLifecycle(): void {
  const authStore = useAuthStore()
  const bootstrapStore = useBootstrapStore()
  const { checkUnseenWins } = usePrettyIdUnseenWins()

  watch(
    () => [authStore.isAuthenticated, bootstrapStore.prettyIdAuctionEnabled],
    () => { void checkUnseenWins() },
    { immediate: true },
  )

  const offForeground = onAppForeground(() => { void checkUnseenWins() })
  onScopeDispose(offForeground)
}
