/**
 * Room Video start state (room-video-player 09)
 *
 * Pure decision: should the Room Video panel open collapsed? A weak phone
 * (`low` / `unknown` tier) starts collapsed so the video is not decoded while
 * hidden behind the 40 px bar; `mid` / `high` phones start expanded. The user's
 * "Always start video collapsed" switch forces collapsed on any tier.
 *
 * Framework-free: no Vue, no DOM. The tier read lives in the composable layer.
 */
import type { DeviceClass } from '~/utils/device-class';

export function resolveVideoStartCollapsed(
  deviceClass: DeviceClass,
  alwaysStartCollapsed: boolean,
): boolean {
  if (alwaysStartCollapsed) return true;
  return deviceClass === 'low' || deviceClass === 'unknown';
}
