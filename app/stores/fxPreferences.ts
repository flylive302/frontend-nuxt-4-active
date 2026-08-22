/**
 * FX Preferences Store
 *
 * Per-device, per-user visual-effect mute preferences. Purely client-side
 * (localStorage-persisted, no backend column): muting only suppresses the
 * LOCAL rendering of an animation — coins, XP, transactions, and what other
 * participants see are untouched.
 */
import { defineStore } from 'pinia';

export const useFxPreferencesStore = defineStore('fxPreferencesStore', () => {
  // ========================================
  // State
  // ========================================

  /** When true, no gift animation (playback modal / lucky fly) renders on this device. */
  const muteGiftAnimations = ref(false);

  /** When true, no entry animation renders on this device when a user joins. */
  const muteEntryAnimations = ref(false);

  // ========================================
  // Setters
  // ========================================

  function toggleGiftMute() {
    muteGiftAnimations.value = !muteGiftAnimations.value;
  }

  function toggleEntryMute() {
    muteEntryAnimations.value = !muteEntryAnimations.value;
  }

  return {
    muteGiftAnimations,
    muteEntryAnimations,
    toggleGiftMute,
    toggleEntryMute,
  };
}, {
  // storage: localStorage, from the nuxt.config default. This was an implicit
  // COOKIE until 2026-08-22 — see that file's note before changing it.
  persist: {
    pick: ['muteGiftAnimations', 'muteEntryAnimations'],
  },
});
