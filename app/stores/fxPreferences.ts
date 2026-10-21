/**
 * FX Preferences Store
 *
 * Per-device, per-user visual-effect mute preferences. Purely client-side
 * (localStorage-persisted, no backend column): muting only suppresses the
 * LOCAL rendering of an animation — coins, XP, transactions, and what other
 * participants see are untouched.
 */
import { defineStore } from 'pinia';
import type { AnimatedAvatarFramesPreference } from '~/utils/frame-animation-tier';
import {
  defaultFxForTier,
  normalizeFxMutePreference,
  readFxTier,
  resolveFxMuted,
  type FxMutePreference,
} from '~/utils/fx-tier-defaults';

export const useFxPreferencesStore = defineStore('fxPreferencesStore', () => {
  // ========================================
  // State
  // ========================================

  /**
   * Gift Mute switch, MUTE axis (cost-and-speed-tuning/14): `auto` = device tier
   * decides (muted on low only), `on` = muted, `off` = always plays.
   * Persisted under the legacy key name; the old boolean shape is migrated in
   * `afterHydrate` below (false -> auto, true -> on). Read the EFFECTIVE value
   * through `giftAnimationsMuted`, never this raw switch.
   */
  const muteGiftAnimations = ref<FxMutePreference>('auto');

  /** Entry Mute switch, same semantics as `muteGiftAnimations`. */
  const muteEntryAnimations = ref<FxMutePreference>('auto');

  /** Hardware does not change for the life of the page; read once. */
  const tierDefaults = defaultFxForTier(readFxTier());

  /**
   * Animated seat avatar frames (android-client-performance/16, ADR 0039).
   * `auto` = the device tier decides (still on ≤ 4 GB phones); `on` / `off`
   * override the tier both ways. Resolution lives in
   * `utils/frame-animation-tier.ts`; this store only holds the raw switch.
   */
  const animatedAvatarFrames = ref<AnimatedAvatarFramesPreference>('auto');

  // ========================================
  // Computed
  // ========================================

  /** Effective: true = no gift animation renders (switch x tier). */
  const giftAnimationsMuted = computed(() =>
    resolveFxMuted(normalizeFxMutePreference(muteGiftAnimations.value), tierDefaults.giftAnimations),
  );

  /** Effective: true = no entry animation renders (switch x tier). */
  const entryAnimationsMuted = computed(() =>
    resolveFxMuted(normalizeFxMutePreference(muteEntryAnimations.value), tierDefaults.entryAnimations),
  );

  // ========================================
  // Setters
  // ========================================

  function setGiftMute(value: FxMutePreference) {
    muteGiftAnimations.value = value;
  }

  function setEntryMute(value: FxMutePreference) {
    muteEntryAnimations.value = value;
  }

  function setAnimatedAvatarFrames(value: AnimatedAvatarFramesPreference) {
    animatedAvatarFrames.value = value;
  }

  return {
    muteGiftAnimations,
    muteEntryAnimations,
    animatedAvatarFrames,
    giftAnimationsMuted,
    entryAnimationsMuted,
    setGiftMute,
    setEntryMute,
    setAnimatedAvatarFrames,
  };
}, {
  // storage: localStorage, from the nuxt.config default. This was an implicit
  // COOKIE until 2026-08-22 — see that file's note before changing it.
  persist: {
    pick: ['muteGiftAnimations', 'muteEntryAnimations', 'animatedAvatarFrames'],
    // One-shot migration: installs persisted these as booleans. `$patch` copies
    // whatever shape is in storage, so normalize right after hydration; the next
    // persist write stores the tri-state. The computeds normalize too, so a stray
    // legacy value can never mis-resolve even if this hook did not run.
    afterHydrate: ({ store }) => {
      store.muteGiftAnimations = normalizeFxMutePreference(store.muteGiftAnimations);
      store.muteEntryAnimations = normalizeFxMutePreference(store.muteEntryAnimations);
    },
  },
});
