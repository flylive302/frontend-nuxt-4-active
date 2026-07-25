/**
 * Device-class classifier — pure, so it can be unit-tested.
 *
 * The user base is predominantly low-end to mid-tier Android, and several open
 * questions ("is this correlated with weak hardware?") cannot be answered
 * without a coarse device tier on each record. Coarse is the point: three
 * buckets are queryable, a raw GB/core count is not.
 */

import {
  DEVICE_CORES_LOW,
  DEVICE_CORES_MID,
  DEVICE_MEMORY_LOW_GB,
  DEVICE_MEMORY_MID_GB,
} from '~/constants/telemetry';

export type DeviceClass = 'low' | 'mid' | 'high' | 'unknown';

/** The subset of `navigator` this classifier reads. */
export interface DeviceCapabilities {
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/**
 * Classify a device from its reported capabilities.
 *
 * `deviceMemory` wins when present — RAM is the constraint that actually drives
 * WebView renderer kills, which is the fault this classification exists to
 * correlate against. Core count is the fallback for engines that omit it.
 */
export function classifyDeviceClass(capabilities: DeviceCapabilities): DeviceClass {
  const { deviceMemory, hardwareConcurrency } = capabilities;

  if (typeof deviceMemory === 'number' && deviceMemory > 0) {
    if (deviceMemory <= DEVICE_MEMORY_LOW_GB) return 'low';
    if (deviceMemory <= DEVICE_MEMORY_MID_GB) return 'mid';
    return 'high';
  }

  if (typeof hardwareConcurrency === 'number' && hardwareConcurrency > 0) {
    if (hardwareConcurrency <= DEVICE_CORES_LOW) return 'low';
    if (hardwareConcurrency <= DEVICE_CORES_MID) return 'mid';
    return 'high';
  }

  return 'unknown';
}

/** Read this device's capabilities. Returns `{}` outside a browser. */
export function readDeviceCapabilities(): DeviceCapabilities {
  if (typeof navigator === 'undefined') return {};

  const nav = navigator as Navigator & { deviceMemory?: number };

  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  };
}
