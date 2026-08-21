/**
 * Mice Wave Ring Color (svga-removal 01)
 *
 * Pure resolver: turns an equipped mice-wave prop's `metadata.color` into a
 * validated CSS color string for the seat's speaking-indicator ring pulse.
 * Missing or malformed input falls back to `DEFAULT_SPEAKING_RING_COLOR`.
 *
 * Deliberately framework-free — no Vue reactivity, no store imports. Takes
 * the raw `metadata` value (not a prop object) so it stays trivially testable
 * with plain objects and carries no coupling to `BootstrapProp`.
 *
 * Validation is an allowlist, not a truthiness check: the resolved string is
 * interpolated into an inline style (`--seat-ring-color`), so anything that
 * isn't a recognizable CSS color literal is rejected rather than passed
 * through.
 */
import { DEFAULT_SPEAKING_RING_COLOR } from '~/constants/room';

/** `#rgb`, `#rgba`, `#rrggbb`, or `#rrggbbaa`. */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/** `rgb(...)` / `rgba(...)` with numeric or percentage channels only. */
const RGB_FUNCTION_RE = /^rgba?\(\s*[\d.%\s,/]+\)$/i;

/** Whether `value` is a CSS color literal safe to interpolate into a style. */
function isValidCssColor(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 32) return false;
  return HEX_COLOR_RE.test(trimmed) || RGB_FUNCTION_RE.test(trimmed);
}

/**
 * Resolve the active-speaker ring color from a prop's `metadata`.
 *
 * @param metadata - `BootstrapProp['metadata']` (or any unknown value) —
 *   typically `resolveProp(mice_wave_id)?.metadata`.
 * @returns A validated CSS color string, or the default ring color when
 *   `metadata`, `metadata.color`, or the color value itself is missing or
 *   malformed.
 */
export function resolveMiceWaveRingColor(metadata: unknown): string {
  if (metadata == null || typeof metadata !== 'object') return DEFAULT_SPEAKING_RING_COLOR;

  const color = (metadata as Record<string, unknown>).color;
  if (typeof color !== 'string') return DEFAULT_SPEAKING_RING_COLOR;

  return isValidCssColor(color) ? color.trim() : DEFAULT_SPEAKING_RING_COLOR;
}
