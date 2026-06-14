// ========================================
// Social Auth Deep-Link Parser
// ========================================
// Pure function — no Vue/Capacitor/network deps. Extracts the result of a
// native social-auth round-trip from the custom-scheme return URL the backend
// redirects to: `com.flylive.app://callback?code=…` or `?error=…`.
//
// Tokens and `is_new` are NOT in the URL on native — only a single-use `code`
// (or an `error` message). See ADR 0011 / capacitor-09.

export interface SocialAuthDeepLinkResult {
  code?: string
  error?: string
}

/**
 * Parse a native social-auth return URL into its typed result.
 *
 * Uses the URL API (handles the dotted custom scheme) with a regex fallback for
 * any string the URL constructor rejects. Unknown/garbage input yields an empty
 * result — the caller treats that as "not a callback URL".
 */
export function parseSocialAuthDeepLink(url: string): SocialAuthDeepLinkResult {
  if (!url) return {}

  const query = extractQuery(url)
  if (!query) return {}

  const params = new URLSearchParams(query)
  const code = params.get('code') ?? undefined
  const error = params.get('error') ?? undefined

  return { code, error }
}

/**
 * Pull the raw query string out of a URL, tolerating custom schemes.
 */
function extractQuery(url: string): string | null {
  try {
    return new URL(url).search.replace(/^\?/, '') || null
  } catch {
    // Fallback for inputs the URL constructor rejects.
    const idx = url.indexOf('?')
    return idx === -1 ? null : url.slice(idx + 1) || null
  }
}
