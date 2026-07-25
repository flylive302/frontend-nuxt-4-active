// ========================================
// reportMalformedPayload Tests
// ========================================
// Instrumentation for JAVASCRIPT-VUE-74. The whole point of this helper is to
// make the NEXT occurrence attributable, so the tests assert on the diagnostic
// content — above all that a non-JSON 200 (the Cloudflare Pages SPA shell)
// arrives in Sentry with a snippet that identifies it on sight.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const captureMessage = vi.fn()
vi.mock('@sentry/nuxt', () => ({ captureMessage: (...args: unknown[]) => captureMessage(...args) }))

const { reportMalformedPayload, resetMalformedPayloadReports } = await import(
  '~/utils/api/reportMalformedPayload'
)

beforeEach(() => {
  captureMessage.mockClear()
  resetMalformedPayloadReports()
})

describe('reportMalformedPayload', () => {
  it('captures an HTML-shell response with an identifying snippet', () => {
    const html = `<!DOCTYPE html><html class="dark" lang="en"><head><title>FlyLive</title>${'x'.repeat(500)}`

    reportMalformedPayload('/user/room/join-requests/mine', html)

    expect(captureMessage).toHaveBeenCalledOnce()
    const [message, options] = captureMessage.mock.calls[0] as [string, Record<string, never>]
    expect(message).toBe('Malformed list payload: /user/room/join-requests/mine')

    const opts = options as unknown as {
      level: string
      tags: Record<string, string>
      extra: Record<string, unknown>
    }
    expect(opts.level).toBe('warning')
    expect(opts.tags.source).toBe('malformed-list-payload')
    expect(opts.tags.endpoint).toBe('/user/room/join-requests/mine')
    expect(opts.extra.payloadType).toBe('string')
    expect(opts.extra.snippet).toContain('<!DOCTYPE html>')
    // Bounded so a large body can't bloat the event.
    expect((opts.extra.snippet as string).length).toBe(200)
    expect(opts.extra.length).toBe(html.length)
  })

  it('records the keys and data type of an unexpected JSON envelope', () => {
    reportMalformedPayload('/user/room/invitations', { status: 'success', data: null, meta: {} })

    const opts = captureMessage.mock.calls[0]![1] as unknown as { extra: Record<string, unknown> }
    expect(opts.extra.payloadType).toBe('object')
    expect(opts.extra.keys).toEqual(['status', 'data', 'meta'])
    expect(opts.extra.dataType).toBe('object')
  })

  it.each([
    ['undefined', undefined, 'undefined'],
    ['null', null, 'null'],
  ])('handles a %s payload without throwing', (_label, payload, expected) => {
    expect(() => reportMalformedPayload('/some/endpoint', payload)).not.toThrow()
    const opts = captureMessage.mock.calls[0]![1] as unknown as { extra: Record<string, unknown> }
    expect(opts.extra.payloadType).toBe(expected)
  })

  it('dedupes repeat reports for the same endpoint within a page load', () => {
    reportMalformedPayload('/user/room/invitations', 'bad')
    reportMalformedPayload('/user/room/invitations', 'bad again')
    reportMalformedPayload('/user/room/invitations', 'and again')

    expect(captureMessage).toHaveBeenCalledOnce()
  })

  it('still reports a different endpoint', () => {
    reportMalformedPayload('/user/room/invitations', 'bad')
    reportMalformedPayload('/user/room/join-requests/mine', 'bad')

    expect(captureMessage).toHaveBeenCalledTimes(2)
  })
})
