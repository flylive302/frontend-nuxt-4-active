/**
 * useNameMotion (android-client-performance/17 fix 3)
 *
 * Whether name motion (the VIP name glint and scrolling name/badge marquees)
 * runs on this device right now: device tier × the user's "Names" switch
 * (`stores/fxPreferences.ts`, tier cut in `utils/fx-tier-defaults.ts` —
 * still by default below `high`). Shared by `useVipGlint`, `<MarqueeName>`,
 * `<EquippedBadgeMarquee>` and the room settings drawer.
 */
import { computed } from 'vue'

export function useNameMotion() {
  const fxPrefs = useFxPreferencesStore()

  /** Whether names may animate (glint + marquees) on this device right now. */
  const nameMotionEnabled = computed(() => fxPrefs.nameMotionEnabled)

  /**
   * Flip the user switch against the EFFECTIVE state: a user on a still-by-
   * default phone who taps "Names" gets `on`; one seeing motion gets `off`.
   * `auto` is only ever the untouched default.
   */
  function toggleNameMotion(): void {
    fxPrefs.setAnimatedNames(nameMotionEnabled.value ? 'off' : 'on')
  }

  return { nameMotionEnabled, toggleNameMotion }
}
