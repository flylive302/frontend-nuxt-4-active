import { describe, expect, it } from 'vitest'
import { resolveTracePropagationTargets } from '~/utils/trace-targets'

/**
 * observability-audio-quality/12.
 *
 * The load-bearing behaviour is that the API's ORIGIN is added while Sentry's
 * same-origin defaults survive. Losing either half is silent: no propagation to
 * the API, or no propagation to the same-origin BFF routes.
 */
describe('resolveTracePropagationTargets', () => {
  it('adds the API origin so cross-origin calls are traced', () => {
    const targets = resolveTracePropagationTargets('https://api.example.com/api/v1')

    expect(targets).toContain('https://api.example.com')
  })

  it('strips the path from the API base', () => {
    // Sentry matches the full outgoing URL. Keeping `/api/v1` would miss calls
    // to sibling paths on the same host, e.g. `/sanctum/csrf-cookie`.
    const targets = resolveTracePropagationTargets('https://api.example.com/api/v1')

    expect(targets).not.toContain('https://api.example.com/api/v1')
  })

  it('keeps the same-origin defaults, which setting the option would otherwise replace', () => {
    const targets = resolveTracePropagationTargets('https://api.example.com/api/v1')

    expect(targets).toContain('localhost')
    expect(targets.some((t) => t instanceof RegExp && t.test('/api/rooms'))).toBe(true)
  })

  it('preserves a non-default port', () => {
    const targets = resolveTracePropagationTargets('http://localhost:8000/api/v1')

    expect(targets).toContain('http://localhost:8000')
  })

  it('falls back to the defaults when apiBase is undefined', () => {
    const targets = resolveTracePropagationTargets(undefined)

    expect(targets).toHaveLength(2)
    expect(targets).toContain('localhost')
  })

  it('falls back to the defaults when apiBase is unparseable rather than throwing', () => {
    // This runs inside `Sentry.init`. Throwing here would take error reporting
    // down with it, which is strictly worse than not propagating a trace.
    expect(() => resolveTracePropagationTargets('not a url')).not.toThrow()
    expect(resolveTracePropagationTargets('not a url')).toHaveLength(2)
  })

  it('falls back to the defaults when apiBase is an empty string', () => {
    expect(resolveTracePropagationTargets('')).toHaveLength(2)
  })
})
