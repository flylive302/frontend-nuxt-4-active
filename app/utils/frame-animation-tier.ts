/**
 * Frame Animation Tier (android-client-performance/16, ADR 0039)
 *
 * Pure decision module: how many seats may run a LIVE animated SVGA avatar
 * frame on this device, given the device tier and the user's switch.
 *
 * Measured 2026-09-23 on an Oppo A6x (SD685, 4 GB): five always-on SVGA seat
 * loops alone kept the main thread ~89 % busy at ~5 fps. On phones reporting
 * ≤ 4 GB (or ≤ 6 cores when memory is unreadable, or nothing at all) every
 * seat frame therefore renders as its cached still by default; stronger
 * phones keep the existing budget of FRAME_ANIMATION_BUDGET concurrent
 * players. The user switch overrides the tier both ways.
 *
 * The tier cut reuses `classifyDeviceClass()` unchanged (4 GB lands in `mid`,
 * so `low` + `mid` + `unknown` are all still). Its thresholds also feed
 * telemetry — do not move them from here.
 *
 * Framework-free: no Vue, no DOM. `readFrameAnimationTier()` is the only
 * browser read and lives at the bottom for the composable layer.
 */
import { FRAME_ANIMATION_BUDGET } from '~/constants/room';
import {
  classifyDeviceClass,
  readDeviceCapabilities,
  type DeviceClass,
} from '~/utils/device-class';

/**
 * User switch for animated seat avatar frames.
 *  - `auto`: the device tier decides (the untouched default).
 *  - `on`:   animate on any tier (budget FRAME_ANIMATION_BUDGET).
 *  - `off`:  every seat frame is a still.
 */
export type AnimatedAvatarFramesPreference = 'auto' | 'on' | 'off';

export const ANIMATED_AVATAR_FRAMES_PREFERENCES: readonly AnimatedAvatarFramesPreference[] =
  ['auto', 'on', 'off'];

/** Tier default: only `high` devices animate. */
export function defaultFrameAnimationCap(deviceClass: DeviceClass): number {
  return deviceClass === 'high' ? FRAME_ANIMATION_BUDGET : 0;
}

/** Effective concurrent-animation cap after applying the user switch. */
export function resolveFrameAnimationCap(
  preference: AnimatedAvatarFramesPreference,
  deviceClass: DeviceClass,
): number {
  if (preference === 'on') return FRAME_ANIMATION_BUDGET;
  if (preference === 'off') return 0;
  return defaultFrameAnimationCap(deviceClass);
}

/** Type guard for values read back from persisted storage. */
export function isAnimatedAvatarFramesPreference(
  value: unknown,
): value is AnimatedAvatarFramesPreference {
  return (ANIMATED_AVATAR_FRAMES_PREFERENCES as readonly unknown[]).includes(value);
}

/** This device's tier, read once per call from `navigator`. `unknown` outside a browser. */
export function readFrameAnimationTier(): DeviceClass {
  return classifyDeviceClass(readDeviceCapabilities());
}
