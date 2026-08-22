/**
 * Resolve the SVGA plugin handle for callers that preload gift assets.
 *
 * `giftAssetCache` (a service) must not import the Nuxt runtime, so the
 * `$svga` handle is threaded in from composables. Returns `undefined` outside
 * a Nuxt app context (unit tests) or before the client plugin registered.
 */
import type { SvgaPlugin } from '~/services/giftAssetCache'

export function resolveSvgaPlugin(): SvgaPlugin | undefined {
  try {
    return useNuxtApp().$svga as SvgaPlugin | undefined
  } catch {
    return undefined
  }
}
