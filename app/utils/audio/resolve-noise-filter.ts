/**
 * RNNoise mic-filter resolution — pure, so it can be unit-tested without a
 * real AudioContext or device.
 *
 * The filter runs on an AudioWorklet, which costs CPU. Low-tier devices (see
 * `~/utils/device-class.ts`) are the ones most likely to already be struggling
 * with the mic AudioContext passthrough (F-26), so 'auto' only turns it on for
 * mid/high tiers — and only when the browser actually supports AudioWorklet.
 */

import type { DeviceClass } from '~/utils/device-class';
import type { NoiseFilterMode } from '~/stores/audioPreferences';

/**
 * Decide whether the RNNoise filter should be wired into the mic graph.
 *
 * - 'on'  → true iff the browser supports AudioWorklet.
 * - 'off' → always false.
 * - 'auto' → true only when supported AND the device is 'mid' or 'high'
 *   ('low' and 'unknown' stay off — the unknown case fails safe toward the
 *   assumption that we don't know the hardware can afford it).
 */
export function resolveNoiseFilter(
  mode: NoiseFilterMode,
  deviceClass: DeviceClass,
  workletSupported: boolean,
): boolean {
  if (mode === 'off') return false;
  if (mode === 'on') return workletSupported;
  return workletSupported && (deviceClass === 'mid' || deviceClass === 'high');
}

/** True when this browser can load and run an AudioWorklet-based node. */
export function isAudioWorkletSupported(): boolean {
  if (typeof AudioWorkletNode === 'undefined') return false;

  const Ctor = (typeof AudioContext !== 'undefined' ? AudioContext : undefined)
    || (typeof window !== 'undefined'
      ? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      : undefined);

  return typeof Ctor !== 'undefined' && 'audioWorklet' in Ctor.prototype;
}
