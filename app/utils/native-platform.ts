import { Capacitor } from '@capacitor/core'

/**
 * True only inside the native iOS shell (Capacitor). Impure: reads the bridge.
 * Used to hide flows Apple's review treats as out-of-store purchases
 * (coin requests). Web + Android unaffected.
 */
export function isIosNative(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

/** True only inside the native Android shell (Capacitor). Web + iOS unaffected. */
export function isAndroidNative(): boolean {
  return Capacitor.getPlatform() === 'android'
}

/**
 * Which store's "Buy Coins" flow applies on this shell, or `null` on the web
 * (or any other platform) where no native store purchase exists.
 */
export function storeFor(): 'apple' | 'google' | null {
  if (isIosNative()) return 'apple'
  if (isAndroidNative()) return 'google'
  return null
}
