/**
 * Audio Preferences Store
 *
 * Per-device audio settings. Purely client-side (localStorage-persisted, no
 * backend column). State + setters only — resolution logic (device tier,
 * AudioWorklet support) lives in `utils/audio/resolve-noise-filter.ts`.
 */
import { defineStore } from 'pinia';

export type NoiseFilterMode = 'auto' | 'on' | 'off';

/** Default talk-over duck target: music drops TO this % of the slider volume. */
export const DEFAULT_DUCK_LEVEL_PERCENT = 20;
export const MIN_DUCK_LEVEL_PERCENT = 5;
export const MAX_DUCK_LEVEL_PERCENT = 80;

export const useAudioPreferencesStore = defineStore('audioPreferencesStore', () => {
  // ========================================
  // State
  // ========================================

  /** RNNoise mic filter: 'auto' = on for mid/high device tiers, off on low. */
  const noiseFilterMode = ref<NoiseFilterMode>('auto');

  /** Talk-over duck target, % of the slider volume the music ducks TO. */
  const duckLevelPercent = ref(DEFAULT_DUCK_LEVEL_PERCENT);

  // ========================================
  // Setters
  // ========================================

  function setNoiseFilterMode(mode: NoiseFilterMode) {
    noiseFilterMode.value = mode;
  }

  function setDuckLevelPercent(percent: number) {
    const clamped = Math.min(MAX_DUCK_LEVEL_PERCENT, Math.max(MIN_DUCK_LEVEL_PERCENT, Math.round(percent)));
    duckLevelPercent.value = Number.isFinite(clamped) ? clamped : DEFAULT_DUCK_LEVEL_PERCENT;
  }

  return {
    noiseFilterMode,
    duckLevelPercent,
    setNoiseFilterMode,
    setDuckLevelPercent,
  };
}, {
  // storage: localStorage via the nuxt.config default (never cookies — see
  // the ticket-12 note in nuxt.config.ts).
  persist: {
    pick: ['noiseFilterMode', 'duckLevelPercent'],
  },
});
