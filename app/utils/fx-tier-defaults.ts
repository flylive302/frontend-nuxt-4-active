/**
 * FX Tier Defaults (cost-and-speed-tuning/14)
 *
 * Pure decision module: which visual effects run by default on this device
 * class, and how the user's switch overrides that. Same shape as
 * `frame-animation-tier.ts`; it reuses `classifyDeviceClass()` unchanged.
 * Only `low` is "weak"; `mid`, `high` and `unknown` keep today's behaviour.
 * Operator call 2026-10-22: `mid` covers most iPhones and 4-6 GB Androids
 * (Chrome rounds deviceMemory down), and muting paid gifts for them by
 * default was rejected — revisit `mid` with tier telemetry.
 *
 * Semantics of the two persisted switches (Gift Mute / Entry Mute) are on the
 * MUTE axis, matching the existing UI wording:
 *  - `auto`: the tier decides (the untouched default).
 *  - `on`:   mute is ON  -> the animation never renders.
 *  - `off`:  mute is OFF -> the animation always renders, on any tier.
 * The legacy persisted boolean maps `false -> auto`, `true -> on` (a user who
 * explicitly muted stays muted; a user who never touched it gets the tier).
 *
 * Framework-free: no Vue, no DOM. `readFxTier()` is the only browser read.
 */
import { readFrameAnimationTier } from '~/utils/frame-animation-tier';
import type { DeviceClass } from '~/utils/device-class';

/** Tri-state user switch on the MUTE axis. */
export type FxMutePreference = 'auto' | 'on' | 'off';

export const FX_MUTE_PREFERENCES: readonly FxMutePreference[] = ['auto', 'on', 'off'];

/** Generic user switch for a tier-defaulted feature (`on` = enabled). */
export type FxEnablePreference = 'auto' | 'on' | 'off';

/** Whether each effect is enabled by default on a device class. */
export interface FxTierDefaults {
  giftAnimations: boolean;
  entryAnimations: boolean;
  viewTransitions: boolean;
}

/** Tier defaults: only `low` devices lose effects by default. */
export function defaultFxForTier(deviceClass: DeviceClass): FxTierDefaults {
  const enabled = deviceClass !== 'low';
  return { giftAnimations: enabled, entryAnimations: enabled, viewTransitions: enabled };
}

/** Type guard for values read back from persisted storage. */
export function isFxMutePreference(value: unknown): value is FxMutePreference {
  return (FX_MUTE_PREFERENCES as readonly unknown[]).includes(value);
}

/**
 * One-shot migration of a persisted value of any historical shape.
 * boolean `true` -> `on`, boolean `false` -> `auto`, valid tri-state -> itself,
 * anything else (corrupt/missing) -> `auto`.
 */
export function normalizeFxMutePreference(value: unknown): FxMutePreference {
  if (value === true) return 'on';
  if (isFxMutePreference(value)) return value;
  return 'auto';
}

/**
 * Effective "animation enabled" after applying the user's switch.
 * `tierDefaultEnabled` is the tier's default for this effect.
 */
export function resolveFxEnabled(
  preference: FxEnablePreference,
  tierDefaultEnabled: boolean,
): boolean {
  if (preference === 'on') return true;
  if (preference === 'off') return false;
  return tierDefaultEnabled;
}

/**
 * Effective "muted" for a MUTE-axis switch: `on` mutes, `off` plays,
 * `auto` follows the tier (muted when the tier default is disabled).
 */
export function resolveFxMuted(
  mutePreference: FxMutePreference,
  tierDefaultEnabled: boolean,
): boolean {
  if (mutePreference === 'on') return true;
  if (mutePreference === 'off') return false;
  return !tierDefaultEnabled;
}

/** Cycle order for a tap on the tri-state tile: auto -> on -> off -> auto. */
export function nextFxMutePreference(current: FxMutePreference): FxMutePreference {
  if (current === 'auto') return 'on';
  if (current === 'on') return 'off';
  return 'auto';
}

/** This device's tier, read once per call from `navigator`. */
export function readFxTier(): DeviceClass {
  return readFrameAnimationTier();
}
