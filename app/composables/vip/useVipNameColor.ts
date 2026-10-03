import { VIP_GLINT_MIN_CHROMA, VIP_GLINT_MIN_LIGHTNESS } from '~/constants/vip'
import { glintColour } from '~/utils/vip-glint'

// ========================================
// State
// ========================================

/** Raw backend hex → glint hex. A handful of entries (one per VIP colour). */
const glintByHex = new Map<string, string>()

// ========================================
// Composable
// ========================================

/**
 * Resolve the VIP accent colour for a level — the colour of the glint that
 * sweeps across a VIP user's (white) name.
 *
 * Reads `bootstrapStore.vipColorByLevel` (built once from the bootstrap
 * payload) and raises it to `VIP_GLINT_MIN_LIGHTNESS` / `VIP_GLINT_MIN_CHROMA`,
 * keeping the hue, so near-black or dull admin picks stay vivid on the dark UI
 * and over white text. Cached per colour: per render this is two Map lookups.
 * Returns '' for level 0 / unknown, meaning "not VIP — no glint".
 */
export function useVipNameColor() {
  const bootstrapStore = useBootstrapStore()

  function vipNameColor(level: number | null | undefined): string {
    if (!level) return ''
    const raw = bootstrapStore.vipColorByLevel.get(level)
    if (!raw) return ''
    let glint = glintByHex.get(raw)
    if (glint === undefined) {
      glint = glintColour(raw, VIP_GLINT_MIN_LIGHTNESS, VIP_GLINT_MIN_CHROMA)
      glintByHex.set(raw, glint)
    }
    return glint
  }

  return { vipNameColor }
}
