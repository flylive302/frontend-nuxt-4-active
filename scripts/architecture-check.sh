#!/usr/bin/env bash
set -euo pipefail

echo "Running frontend architecture checks..."

violations=0

check() {
  local message="$1"
  local pattern="$2"
  local target="$3"
  if grep -R -nE "$pattern" "$target" >/tmp/arch_check_frontend.out; then
    echo "FAIL: $message"
    cat /tmp/arch_check_frontend.out
    violations=$((violations + 1))
  fi
}

# observability-audio-quality/12: these patterns used to be `\$fetch\s*\(`, which
# requires `(` immediately after `$fetch` — so a TypeScript generic call like
# `$fetch<RoomsResponse>(...)` slipped through silently. That is exactly how the
# home page's room fetch lived in a SCANNED directory while violating the rule.
# `[<(]` admits both forms. Do not narrow it back to `\(`.
check "Stores must not call API directly" 'useApi\s*[<(]|\$fetch\s*[<(]|useFetch\s*[<(]' app/stores
check "Stores must not trigger toasts" 'useToast\s*\(' app/stores
check "Components must not call API directly" 'useApi\s*[<(]|\$fetch\s*[<(]|useFetch\s*[<(]' app/components
check "Pages must not call API directly" 'useApi\s*[<(]|\$fetch\s*[<(]|useFetch\s*[<(]' app/pages
check "Components must not emit sockets directly" 'socket\s*\.\s*emit\s*\(' app/components
check "Pages must not emit sockets directly" 'socket\s*\.\s*emit\s*\(' app/pages

# observability-audio-quality/12: `app/composables` is the layer that SHOULD call
# `useApi()`, so it cannot be added to the blanket checks above. What it must not
# do is reach an `/api/` path with a bare `$fetch`, which silently drops the auth,
# correlation and device headers `useApi`'s `onRequest` injects.
#
# Deliberate exceptions opt out with an `arch-allow-bare-fetch:` marker plus a
# reason (the same-origin Nitro BFF routes are shared-CACHED, so a per-user
# correlation header on them would be meaningless at best and cross-user at
# worst). The marker is file-scoped and greppable on purpose — an undocumented
# bypass should fail, a documented one should be findable.
#
# ⚠️ Two known limitations, both deliberate trade-offs of a grep-based check:
#   1. The marker exempts the WHOLE FILE, so a second, undocumented bypass added
#      to an already-marked file will not be caught. Keep marked files small.
#   2. It cannot tell code from prose — a doc comment quoting the pattern trips
#      it. Describe the old call, do not reproduce its syntax.
check_bare_api_fetch() {
  local target="$1"
  local hits
  hits=$(grep -R -nE '\$fetch\s*[<(][^)]*/api/' "$target" 2>/dev/null | while IFS= read -r line; do
    file="${line%%:*}"
    grep -q 'arch-allow-bare-fetch' "$file" || printf '%s\n' "$line"
  done)
  if [[ -n "$hits" ]]; then
    echo "FAIL: Bare \$fetch to an /api/ path bypasses useApi (auth + correlation headers are lost)"
    printf '%s\n' "$hits"
    echo "      If deliberate, add an 'arch-allow-bare-fetch: <reason>' comment to the file."
    violations=$((violations + 1))
  fi
}

check_bare_api_fetch app

# boot-and-asset-delivery/02: bundled pictures (`/images/ui/…`, `/logos/…` — any root-relative
# path) load from disk. The asset downloader stores into Cache Storage, which `<img>` never
# reads, so a manifest entry for a bundled file is a pure extra download. Two ways one sneaks
# in: a literal root-relative `url:`, or an `ASSETS.X` whose value in constants/assets.ts is one.
check_manifest_bundle_paths() {
  local manifest=app/constants/assetManifest.ts
  local hits name
  hits=$(grep -nE "url:[[:space:]]*['\"\`]/" "$manifest" || true)
  for name in $(grep -oE "^[[:space:]]+[A-Z0-9_]+:[[:space:]]*['\"\`]/" app/constants/assets.ts | grep -oE '[A-Z0-9_]+' || true); do
    hits+=$'\n'$(grep -nE "ASSETS\.${name}\b" "$manifest" || true)
  done
  hits=$(printf '%s\n' "$hits" | sed '/^$/d')
  if [[ -n "$hits" ]]; then
    echo "FAIL: Asset manifest must not list bundled (root-relative) files — they load from disk"
    printf '%s\n' "$hits"
    violations=$((violations + 1))
  fi
}

check_manifest_bundle_paths

# boot-and-asset-delivery/05: catalog pictures (gift thumbnails, prop images, badge images,
# VIP cards) are never rendered from the raw URL — raw gift thumbnails were ~160 KB each.
# Route them through `~/utils/imagekit` at the slot's CSS px × 2.5. A helper call breaks the
# plain member chain these patterns match, so wrapped bindings pass.
#
# Deliberate exceptions opt out with a file-scoped `arch-allow-raw-catalog-picture:` marker
# plus a reason (e.g. the child component applies the transform itself).
#
# ⚠️ Known limitation: only a DIRECT field read at the sink is caught. A value renamed on the
# way (`:src="resolved.thumbnailUrl"`) passes silently — review those by hand.
check_raw_catalog_pictures() {
  local target="$1"
  local hits
  hits=$(grep -R -nE \
    -e ':(src|poster|thumbnail-src|image-url)="[A-Za-z_$][A-Za-z0-9_$.?!]*\.(thumbnail_url|image_url|icon_url)' \
    -e '\b(src|poster):[[:space:]]*[A-Za-z_$][A-Za-z0-9_$.?!]*\.(thumbnail_url|image_url|icon_url)\b' \
    "$target" 2>/dev/null | while IFS= read -r line; do
    file="${line%%:*}"
    grep -q 'arch-allow-raw-catalog-picture' "$file" || printf '%s\n' "$line"
  done)
  if [[ -n "$hits" ]]; then
    echo "FAIL: Catalog picture rendered from its raw URL — wrap it in a ~/utils/imagekit helper at slot size"
    printf '%s\n' "$hits"
    echo "      If deliberate, add an 'arch-allow-raw-catalog-picture: <reason>' comment to the file."
    violations=$((violations + 1))
  fi
}

check_raw_catalog_pictures app

if [[ $violations -gt 0 ]]; then
  echo "Frontend architecture checks failed with $violations violation group(s)."
  exit 1
fi

echo "Frontend architecture checks passed."
