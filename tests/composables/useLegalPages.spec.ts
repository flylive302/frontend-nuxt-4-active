// ========================================
// useLegalPages Composable Tests
// ========================================
// Apple 1.2 (ios-app-store-release build 6): in the Capacitor WKWebView a
// `target="_blank"` anchor to a bundled legal page is handed to the OS with a
// `capacitor://` URL it cannot open, so the tap does nothing. Native must open
// the live page in the in-app browser; web must keep the plain anchor.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLegalPages } from '~/composables/shared/useLegalPages'

const { mockIsNativePlatform, mockBrowserOpen } = vi.hoisted(() => ({
  mockIsNativePlatform: vi.fn(() => false),
  mockBrowserOpen: vi.fn(async () => undefined),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: mockIsNativePlatform },
}))

vi.mock('@capacitor/browser', () => ({
  Browser: { open: mockBrowserOpen },
}))

vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://flyliveapp.com' } }))

function fakeClick(): Event & { preventDefault: ReturnType<typeof vi.fn> } {
  return { preventDefault: vi.fn() } as unknown as Event & { preventDefault: ReturnType<typeof vi.fn> }
}

describe('useLegalPages', () => {
  beforeEach(() => {
    mockIsNativePlatform.mockReturnValue(false)
    mockBrowserOpen.mockClear()
  })

  it('builds the absolute live URL from runtime siteUrl', () => {
    const { legalPageUrl } = useLegalPages()
    expect(legalPageUrl('terms-of-service')).toBe('https://flyliveapp.com/terms-of-service')
    expect(legalPageUrl('privacy-policy')).toBe('https://flyliveapp.com/privacy-policy')
  })

  it('web: leaves the anchor navigation untouched', async () => {
    const { openLegalPage } = useLegalPages()
    const event = fakeClick()

    await expect(openLegalPage('terms-of-service', event)).resolves.toBe(false)

    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(mockBrowserOpen).not.toHaveBeenCalled()
  })

  it('native: cancels the anchor and opens the live page in the in-app browser', async () => {
    mockIsNativePlatform.mockReturnValue(true)
    const { openLegalPage } = useLegalPages()
    const event = fakeClick()

    await expect(openLegalPage('privacy-policy', event)).resolves.toBe(true)

    expect(event.preventDefault).toHaveBeenCalledTimes(1)
    expect(mockBrowserOpen).toHaveBeenCalledWith({ url: 'https://flyliveapp.com/privacy-policy' })
  })
})
