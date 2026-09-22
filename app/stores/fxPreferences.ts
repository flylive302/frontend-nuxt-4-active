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

export const useFxPreferencesStore = defineStore('fxPreferencesStore', () => {
  // ========================================
  // State
  // ========================================

  /** When true, no gift animation (playback modal / lucky fly) renders on this device. */
  const muteGiftAnimations = ref(false);

  /** When true, no entry animation renders on this device when a user joins. */
  const muteEntryAnimations = ref(false);

  /**
   * Animated seat avatar frames (android-client-performance/16, ADR 0039).
   * `auto` = the device tier decides (still on ≤ 4 GB phones); `on` / `off`
   * override the tier both ways. Resolution lives in
   * `utils/frame-animation-tier.ts`; this store only holds the raw switch.
   */
  const animatedAvatarFrames = ref<AnimatedAvatarFramesPreference>('auto');

  // ========================================
  // Setters
  // ========================================

  function toggleGiftMute() {
    muteGiftAnimations.value = !muteGiftAnimations.value;
  }

  function toggleEntryMute() {
    muteEntryAnimations.value = !muteEntryAnimations.value;
  }

  function setAnimatedAvatarFrames(value: AnimatedAvatarFramesPreference) {
    animatedAvatarFrames.value = value;
  }

  return {
    muteGiftAnimations,
    muteEntryAnimations,
    animatedAvatarFrames,
    toggleGiftMute,
    toggleEntryMute,
    setAnimatedAvatarFrames,
  };
}, {
  // storage: localStorage, from the nuxt.config default. This was an implicit
  // COOKIE until 2026-08-22 — see that file's note before changing it.
  persist: {
    pick: ['muteGiftAnimations', 'muteEntryAnimations', 'animatedAvatarFrames'],
  },
});
