<script setup lang="ts">
// ========================================
// Country Flag (ADR 0027)
// ========================================
//
// INTENT layer: renders one country flag and nothing else.
//
// Two render paths, deliberately hidden from callers:
//   real flag  -> <img> from public/flags/<code>.svg  (static, lazy, in-APK)
//   fallback   -> <UIcon> DEFAULT_FLAG_ICON            (a bundled Iconify icon)
//
// The fallback is used when the code is blank/unknown, and when the file fails
// to load — a user's `country` comes from the API and is not constrained to
// public/countries.json, so an unmapped code must degrade to the globe rather
// than show a broken image.
//
// ⚠️ NO `object-fit` on the <img>, on purpose. Callers pass square sizing
// (`size-6`, `size-8 h-6`, …) written for the old `<UIcon>`, and Iconify's CSS
// mode sets `mask-size: 100% 100%` (@iconify/vue `propsToAdd.Size`) — i.e. it
// STRETCHED the 4:3 flag into whatever box the class gave it. `<img>`'s default
// `object-fit: fill` reproduces that exactly. `object-cover` would silently
// start cropping every flag in the app; `object-contain` would letterbox it.

import { DEFAULT_FLAG_ICON, getFlagSrc, normalizeCountryCode } from '~/utils/flag-icon'

// ========================================
// Types
// ========================================

interface Props {
  /** ISO-ish country code from country data or a user profile (case-insensitive) */
  code: string | null | undefined
  /** Override the accessible name; defaults to the upper-cased code */
  alt?: string
}

// ========================================
// Config
// ========================================

const props = withDefaults(defineProps<Props>(), {
  alt: undefined,
})

// ========================================
// State
// ========================================

/**
 * Codes whose SVG failed to load, scoped to THIS instance.
 *
 * Deliberately not shared/module-level: a flag that 404s during a bad-network
 * moment must be retried once the component remounts, or ADR 0026's "recovers
 * without an app restart" would not hold for flags.
 */
const failedCodes = ref(new Set<string>())

// ========================================
// Computed
// ========================================

const normalized = computed(() => normalizeCountryCode(props.code))
const src = computed(() => (normalized.value && !failedCodes.value.has(normalized.value)
  ? getFlagSrc(props.code)
  : null))
const label = computed(() => props.alt ?? normalized.value?.toUpperCase() ?? '')

// ========================================
// Handlers
// ========================================

function onError(): void {
  if (!normalized.value) return
  // Reassign so the computed above re-evaluates — Set.add alone is not reactive.
  failedCodes.value = new Set(failedCodes.value).add(normalized.value)
}
</script>

<template>
  <img
    v-if="src"
    :src="src"
    :alt="label"
    loading="lazy"
    decoding="async"
    draggable="false"
    @error="onError"
  >
  <UIcon
    v-else
    :name="DEFAULT_FLAG_ICON"
    :aria-label="label || undefined"
  />
</template>
