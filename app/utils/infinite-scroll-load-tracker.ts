/**
 * Tracks which page-load is "current" for the infinite-scroll component.
 *
 * Problem it solves (ticket 14): an aborted fetch's `finally` runs on a later
 * microtask, so a `reload()` fired mid-flight could either see a stale
 * `isLoading` guard or have the stale request's `finally` clear the loading
 * flag that belongs to the NEW request. Generations make staleness explicit:
 * every `begin()` and `invalidate()` bumps the generation, and callers gate
 * their state mutations on `ticket.isCurrent()`.
 */

export interface LoadTicket {
  signal: AbortSignal
  isCurrent: () => boolean
}

export interface LoadTracker {
  /** Abort any in-flight load and start a new current one. */
  begin: () => LoadTicket
  /** Abort any in-flight load and mark every issued ticket stale (reset path). */
  invalidate: () => void
  /** Abort without changing generations (unmount path). */
  abort: () => void
}

export function createLoadTracker(): LoadTracker {
  let controller: AbortController | null = null
  let generation = 0

  return {
    begin(): LoadTicket {
      controller?.abort()
      controller = new AbortController()
      generation += 1
      const ticketGeneration = generation
      return {
        signal: controller.signal,
        isCurrent: () => ticketGeneration === generation
      }
    },
    invalidate(): void {
      controller?.abort()
      controller = null
      generation += 1
    },
    abort(): void {
      controller?.abort()
    }
  }
}
