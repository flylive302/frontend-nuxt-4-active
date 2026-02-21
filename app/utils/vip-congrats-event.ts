// ========================================
// VIP Congratulations Event Bus
// ========================================
// Lightweight event emitter for triggering VIP congrats modal
// from socket events. Uses a simple callback pattern.

type VipCongratsCallback = (vipLevel: number) => void

const listeners: Set<VipCongratsCallback> = new Set()

/**
 * Minimal event bus for VIP congratulations.
 * Emitted from socket events, consumed by VIP page.
 */
export const vipCongratsEvent = {
  /**
   * Register a listener for VIP congrats events.
   * @returns Cleanup function to unsubscribe
   */
  on(callback: VipCongratsCallback): () => void {
    listeners.add(callback)
    return () => listeners.delete(callback)
  },

  /**
   * Emit a VIP congrats event with the new level.
   */
  emit(vipLevel: number): void {
    listeners.forEach(cb => cb(vipLevel))
  },
}
