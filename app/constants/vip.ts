/**
 * VIP name colour per level, used by `common/marquee-name.vue`.
 * Levels 0–2 have no colour (inherit). Keep in sync with the VIP catalogue.
 */
export const VIP_NAME_COLOR: Readonly<Record<number, string>> = {
  3: '#6b3293',
  4: '#ef9d2a',
  5: '#2d1757',
  6: '#bd731f',
  7: '#00bc6f',
  8: '#098dd9',
  9: '#cd0e8c',
  10: '#7e1e07',
  11: '#43d08a',
  12: '#468a25',
}

/** Resolve the name colour for a VIP level; '' = inherit. */
export function vipNameColor(level: number | undefined | null): string {
  return (level && VIP_NAME_COLOR[level]) || ''
}
