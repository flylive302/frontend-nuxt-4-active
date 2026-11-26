// ========================================
// App foreground signal
// ========================================
//
// Tiny publish/subscribe so a feature can react to "the app came back to the
// foreground" without adding its own Capacitor `appStateChange` listener.
// `plugins/foreground-sync.client.ts` is the one publisher; it emits BEFORE its
// 10 s resync debounce, so a subscriber sees every real foreground.

type ForegroundListener = () => void

const listeners = new Set<ForegroundListener>()

/** Subscribes to foreground events. Returns the unsubscribe function. */
export function onAppForeground(listener: ForegroundListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Publisher side: tells every subscriber the app is in the foreground. */
export function emitAppForeground(): void {
  for (const listener of [...listeners]) listener()
}
