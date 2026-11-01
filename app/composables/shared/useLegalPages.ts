/**
 * useLegalPages — opens the public legal pages (Terms of Service, Privacy
 * Policy, Coin Policy) from inside the app.
 *
 * Why (Apple 1.2 / ios-app-store-release, build 6): the legal pages are static
 * HTML shipped inside the web bundle. On the web an anchor with
 * `target="_blank"` opens them in a new tab. In the Capacitor WKWebView the
 * same anchor is handed to `UIApplication.open()` with a
 * `capacitor://localhost/...` URL that iOS cannot open — the tap does nothing,
 * so a reviewer on the consent step can never read the EULA. On native we
 * cancel the anchor and open the LIVE page in the in-app browser
 * (SFSafariViewController / Chrome Custom Tab), whose own Done button returns
 * to the app with the form state intact.
 */
import { Capacitor } from '@capacitor/core'

export type LegalPage = 'terms-of-service' | 'privacy-policy' | 'coin-policy'

export function useLegalPages() {
  const config = useRuntimeConfig()

  /** Absolute URL of the live copy of a legal page on the public site. */
  function legalPageUrl(page: LegalPage): string {
    return `${config.public.siteUrl}/${page}`
  }

  /**
   * GATE: on the web, return `false` and let the anchor navigate as it always
   * has. EXECUTE: on native, cancel the anchor and open the live page in the
   * in-app browser. Resolves `true` when the native path handled the tap.
   */
  async function openLegalPage(page: LegalPage, event?: Event): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false

    event?.preventDefault()
    try {
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: legalPageUrl(page) })
    } catch {
      // Last resort: the bundled copy in the same WebView (reloads the SPA on return).
      window.location.assign(`/${page}`)
    }
    return true
  }

  return { legalPageUrl, openLegalPage }
}
