// ========================================
// Telemetry Composable
// ========================================

// ========================================
// Types
// ========================================

export interface TelemetryEvent {
  name: string
  properties?: Record<string, unknown>
  timestamp?: number
}

// ========================================
// Composable
// ========================================

/**
 * Telemetry composable for tracking application events.
 * Currently logs to console, ready for analytics provider integration.
 */
export function useTelemetry() {
  /**
   * Track an event.
   * Ready to integrate with analytics provider (GA4, Mixpanel, etc.)
   */
  function track(_event: TelemetryEvent): void {
    // Future: Send to analytics provider
  }

  // ========================================
  // Bootstrap Events
  // ========================================

  function trackBootstrapStarted(): void {
    track({ name: 'bootstrap_started' })
  }

  function trackBootstrapCompleted(durationMs: number): void {
    track({
      name: 'bootstrap_completed',
      properties: { duration_ms: durationMs },
    })
  }

  function trackBootstrapFailed(error: string): void {
    track({
      name: 'bootstrap_failed',
      properties: { error },
    })
  }

  // ========================================
  // Return
  // ========================================

  return {
    track,
    trackBootstrapStarted,
    trackBootstrapCompleted,
    trackBootstrapFailed,
  }
}
