import { Capacitor } from '@capacitor/core'

/**
 * True only inside the native iOS shell (Capacitor). Impure: reads the bridge.
 * Used to hide flows Apple's review treats as out-of-store purchases
 * (coin requests). Web + Android unaffected.
 */
export function isIosNative(): boolean {
  return Capacitor.getPlatform() === 'ios'
}
