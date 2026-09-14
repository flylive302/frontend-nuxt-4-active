// ========================================
// Composable
// ========================================

/**
 * Resolve the display-name colour for a VIP level.
 *
 * Reads `bootstrapStore.vipColorByLevel` (built once from the bootstrap
 * payload) — no fetch, no per-render work beyond a Map lookup. Returns '' for
 * level 0 / unknown so callers fall back to `inherit`.
 */
export function useVipNameColor() {
  const bootstrapStore = useBootstrapStore()

  function vipNameColor(level: number | null | undefined): string {
    if (!level) return ''
    return bootstrapStore.vipColorByLevel.get(level) ?? ''
  }

  return { vipNameColor }
}
