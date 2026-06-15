// ========================================
// Audio Route Detector Service
// ========================================
//
// Best-effort classification of the active audio-OUTPUT route (wired / speaker /
// bluetooth) for the Local-monitor policy (capacitor-02). The web platform has
// no reliable "are headphones plugged in?" API, so this is a heuristic over the
// labels exposed by `navigator.mediaDevices.enumerateDevices()`.
//
// Reliability note: output-device LABELS are only populated once the page holds
// a media permission. A *producing* DJ has already granted mic permission, so
// detection is decently reliable in the exact case the policy cares about.
//
// Default-when-unknown is **'speaker'** by deliberate asymmetry: defaulting to a
// headphone route would re-introduce the very bug we ship to fix (music bleeding
// into an open mic) for users we failed to classify, whereas defaulting to
// speaker only costs a missed own-music monitor + a headphone nudge — voice and
// Listeners are unaffected either way. See `utils/local-monitor-policy.ts`.
//
// Native (Capacitor) route detection is a later enhancement; this service is the
// single seam a native plugin would replace.

import type { AudioRoute } from '~/utils/local-monitor-policy'

// ========================================
// Helpers
// ========================================

/** SSR/unsupported-safe handle to the Media Devices API. */
function getMediaDevices(): MediaDevices | null {
  if (typeof navigator === 'undefined') return null
  return navigator.mediaDevices ?? null
}

/** Classify a single output-device label into a route. Unknown → null. */
function classifyLabel(label: string): AudioRoute | null {
  const l = label.toLowerCase()
  if (!l) return null
  if (/bluetooth|airpod|buds|wireless|a2dp|\bbt\b/.test(l)) return 'bluetooth'
  if (/headphone|headset|wired|earphone|earpiece|jack|usb/.test(l)) return 'wired'
  if (/speaker|built-?in|internal|default/.test(l)) return 'speaker'
  return null
}

// ========================================
// Public API
// ========================================

/**
 * Best-effort detection of the active output route.
 *
 * Hard limitation: a web AudioContext follows the OS default sink, and
 * `enumerateDevices()` lists which output devices *exist*, not which is *active*.
 * We therefore treat the presence of a headphone-class output as "the DJ is on
 * it". This is right on a typical phone (a connected BT/wired headset usually IS
 * the active sink — mobile-first), but it can mis-read a **paired-but-inactive**
 * device (earbuds in the case, a car still paired) as the active route → we keep
 * the monitor on while audio actually plays out the speaker. Reliable active-sink
 * detection needs the native (Capacitor) route API — a later enhancement; this
 * service is the seam that plugin replaces. The unknown case still defaults to
 * `'speaker'` so a DJ with no detectable headphones gets the safe monitor cut.
 *
 * @returns the detected route, defaulting to `'speaker'` when undeterminable.
 */
export async function detectAudioRoute(): Promise<AudioRoute> {
  const devices = getMediaDevices()
  if (!devices?.enumerateDevices) return 'speaker'

  try {
    const list = await devices.enumerateDevices()
    const outputs = list.filter((d) => d.kind === 'audiooutput')

    // Prefer the strongest signal: any headphone-class output wins over speaker.
    for (const d of outputs) {
      const route = classifyLabel(d.label)
      if (route === 'bluetooth' || route === 'wired') return route
    }
    // Only a speaker (or empty labels → no permission yet): safe default.
    return 'speaker'
  } catch {
    return 'speaker'
  }
}

/**
 * Subscribe to output-route changes (headphones plugged/unplugged). Returns an
 * unsubscribe function. No-op (returns a no-op cleanup) when unsupported/SSR.
 */
export function onAudioRouteChange(callback: () => void): () => void {
  const devices = getMediaDevices()
  if (!devices?.addEventListener) return () => {}

  devices.addEventListener('devicechange', callback)
  return () => devices.removeEventListener('devicechange', callback)
}
