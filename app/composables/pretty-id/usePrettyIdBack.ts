// ========================================
// Pretty ID — top-bar back navigation
// ========================================
//
// The event's sub-page (search) is reached from a tab,
// so "back" is normally a history pop — which also restores the tab's scroll
// position and plays the back slide. A cold deep link has no history entry
// behind it; popping would leave the app, so it falls back to the Choose tab.

import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'

export function usePrettyIdBack() {
  const router = useRouter()

  function goBack(): void {
    // Vue Router records the previous in-app location on `history.state.back`.
    if (window.history.state?.back) {
      router.back()
      return
    }
    void navigateTo(PRETTY_ID_ROUTES.choose, { replace: true })
  }

  return { goBack }
}
