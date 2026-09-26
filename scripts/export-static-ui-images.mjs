#!/usr/bin/env node
// ========================================
// Export Static UI Images (boot-and-asset-delivery, ticket 02)
// ========================================
//
// Downloads the ImageKit ORIGINALS (no `tr=` transform) for every static UI
// picture that never changes per-user, resizes them once at build time with
// sharp, and writes WebP files into `public/images/ui/`. Those files then
// ship inside the app bundle (disk) instead of being fetched from the CDN at
// runtime — see `app/constants/assets.ts` for why (the SW precache/render-URL
// mismatch that downloaded these twice on every fresh install).
//
// Re-run this script whenever a source image changes:
//   node scripts/export-static-ui-images.mjs
//
// ⚠️ A CHANGED picture must ship under a NEW output name (and the constant in
// `app/constants/assets.ts` updated): `public/_headers` serves `/images/ui/*`
// as `immutable` for a year, so web browsers never re-ask for an existing name.
//
// Each row's `width` is the largest CSS render size across every call site
// (see the per-constant comments in `app/constants/assets.ts`), already
// multiplied by the 2.5x DPR factor documented in `app/utils/imagekit.ts`.
// `sharp`'s `withoutEnlargement` caps the output at the source's native size
// when that target exceeds it — several badges legitimately hit that cap.
//
// Animated sources (the wealth/charm default badges are ~20-frame animated
// WebP) are opened with `{ animated: true }` and the script FAILS LOUDLY if
// the output loses frames.

import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '../public/images/ui')
const IK = 'https://ik.imagekit.io/flylive'
const QUALITY = 75
// Per-file ceiling: catches an outlier (e.g. an animated badge exported far above its slot),
// not the full-bleed heroes, which land at 110-160 KB at their w-1024 slot.
const MAX_BYTES = 200 * 1024

// ========================================
// Export table: {output name, source URL (no tr), width}
// ========================================
// Constants sharing a source URL at the SAME width share one output file
// (documented per-row below with the ASSETS.* keys it backs).

const TABLE = [
  // Heroes
  { name: 'hero-secondary', source: `${IK}/placeholders/secondary.webp`, width: 1024, constants: ['HERO_SECONDARY'] },
  { name: 'hero-tertiary', source: `${IK}/placeholders/tertiary.webp`, width: 1024, constants: ['HERO_TERTIARY'] },
  { name: 'hero-charm', source: `${IK}/placeholders/charm.webp`, width: 1024, constants: ['HERO_CHARM'] },
  { name: 'hero-wealth', source: `${IK}/placeholders/wealth.webp`, width: 1024, constants: ['HERO_WEALTH'] },

  // Placeholders
  { name: 'avatar-placeholder', source: `${IK}/placeholders/avatar.webp`, width: 256, constants: ['AVATAR_PLACEHOLDER'] },
  { name: 'cover-placeholder', source: `${IK}/placeholders/auth-bg.webp`, width: 420, constants: ['COVER_PLACEHOLDER'] },
  { name: 'profile-cover-placeholder', source: `${IK}/placeholders/profile-bg.jpeg`, width: 1200, constants: ['PROFILE_COVER_PLACEHOLDER'] },
  // Base-only constant: largest real caller is `useRoomBackground` (ROOM_BACKGROUND_WIDTH = 960,
  // the room page's full-bleed background). The room-card crop (360x432) and the minimized
  // bubble (320) are both smaller and downscale from this same file.
  { name: 'room-background', source: `${IK}/placeholders/room-background.webp`, width: 960, constants: ['ROOM_BG_PLACEHOLDER'] },

  // Seat
  { name: 'seat-default', source: `${IK}/placeholders/seat.webp`, width: 96, constants: ['DEFAULT_SEAT_IMG'] },
  { name: 'seat-locked', source: `${IK}/placeholders/seat-locked.webp`, width: 96, constants: ['LOCK_SEAT_IMG'] },

  // Currency
  { name: 'coin-icon', source: `${IK}/placeholders/coin-icon.webp`, width: 96, constants: ['COIN_ICON', 'ROOM_CARD_TOP'] },
  { name: 'coin-icon-large', source: `${IK}/placeholders/coin-icon.webp`, width: 192, constants: ['COIN_ICON_LARGE'] },
  { name: 'diamond-icon', source: `${IK}/placeholders/diamond-icon.webp`, width: 64, constants: ['DIAMOND_ICON'] },

  // Gender
  { name: 'gender-female', source: `${IK}/gender/female.webp`, width: 400, constants: ['GENDER_FEMALE'] },
  { name: 'gender-male', source: `${IK}/gender/male.webp`, width: 400, constants: ['GENDER_MALE'] },

  // Default badges
  // Base-only constant: largest real caller is the profile page badge row (`w-7/12` of a
  // ~340 CSS px card => ~240 CSS px) x 2.5 DPR = 600, which exceeds the 512px native width, so
  // `withoutEnlargement` caps this at native. Shared by DEFAULT_WEALTH_BADGE (chat/list fallback)
  // and DEFAULT_WEALTH_LEVEL_BADGE (LevelPage hero/table fallback) — identical source, same width.
  { name: 'badge-wealth-default', source: `${IK}/badges/wealth/1.webp`, width: 600, constants: ['DEFAULT_WEALTH_BADGE', 'DEFAULT_WEALTH_LEVEL_BADGE'] },
  // Same reasoning, charm source (374x136 native): w-5/12 of ~240 CSS px profile card ~= 171 CSS
  // px x 2.5 DPR = 429, exceeds 374 native width, capped.
  { name: 'badge-charm-default', source: `${IK}/badges/charm/1.webp`, width: 429, constants: ['DEFAULT_CHARM_BADGE', 'DEFAULT_CHARM_LEVEL_BADGE'] },
  // Not base-only — already had an explicit tr=w-48; keep the existing slot size.
  { name: 'badge-room-default', source: `${IK}/badges/room/1.webp`, width: 48, constants: ['DEFAULT_ROOM_BADGE'] },
  // Not base-only — already had an explicit tr=w-64; shared by DEFAULT_PROFILE_BADGE and
  // DEFAULT_HISTORY_BADGE (identical source + width).
  //
  // ⚠️ The OLD constant pointed at `${IK}/profile-1.webp`, which 404s (verified against the
  // live CDN 2026-09-26 — `ik-error: ENOENT`). The real asset is one folder over, following the
  // same `badges/<name>` convention as the room/wealth/charm badges. This is a pre-existing
  // production bug predating this ticket (the fallback would have rendered broken if this path
  // were ever actually hit) — flagged for the primary to confirm, not silently "fixed" upstream.
  { name: 'badge-profile-default', source: `${IK}/badges/profile-1.webp`, width: 64, constants: ['DEFAULT_PROFILE_BADGE', 'DEFAULT_HISTORY_BADGE'] },
  // Not base-only — already had an explicit tr=w-128. Same source file as badge-charm-default
  // but a DIFFERENT width, so it gets its own output file (rule: share only at the same width).
  { name: 'transaction-thumb-default', source: `${IK}/badges/charm/1.webp`, width: 128, constants: ['DEFAULT_TRANSACTION_THUMB'] },

  // Gift drawer
  { name: 'gift-drawer-icon', source: `${IK}/placeholders/gift-icon.webp`, width: 64, constants: ['GIFT_DRAWER_ICON'] },
]

// ========================================
// Helpers
// ========================================

const sourceCache = new Map()

async function fetchSource(url) {
  if (sourceCache.has(url)) return sourceCache.get(url)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`404/${res.status} fetching source: ${url}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  sourceCache.set(url, buf)
  return buf
}

async function exportOne(row) {
  const srcBuf = await fetchSource(row.source)
  const srcMeta = await sharp(srcBuf, { animated: true }).metadata()
  const isAnimated = (srcMeta.pages ?? 1) > 1

  const pipeline = sharp(srcBuf, { animated: isAnimated })
    .resize({ width: row.width, withoutEnlargement: true })
    .webp({ quality: QUALITY, effort: 6 })

  const outBuf = await pipeline.toBuffer()
  const outMeta = await sharp(outBuf, { animated: isAnimated }).metadata()

  if (isAnimated) {
    const srcPages = srcMeta.pages ?? 1
    const outPages = outMeta.pages ?? 1
    if (outPages !== srcPages) {
      throw new Error(
        `Frame loss on ${row.name}: source had ${srcPages} pages, output has ${outPages}. ` +
        'Aborting — animated sources must keep all frames.',
      )
    }
  }

  const outPath = path.join(OUT_DIR, `${row.name}.webp`)
  const overBudget = outBuf.length > MAX_BYTES

  if (overBudget) {
    // Do not keep it — leave the constant(s) on the CDN.
    if (existsSync(outPath)) await unlink(outPath)
  } else {
    await writeFile(outPath, outBuf)
  }

  return {
    name: row.name,
    constants: row.constants,
    width: row.width,
    srcWidth: srcMeta.width,
    srcHeight: srcMeta.height,
    srcBytes: srcBuf.length,
    outWidth: outMeta.width,
    outHeight: outMeta.height,
    outBytes: outBuf.length,
    srcPages: srcMeta.pages ?? 1,
    outPages: outMeta.pages ?? 1,
    animated: isAnimated,
    overBudget,
  }
}

// ========================================
// Main
// ========================================

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const results = []
  for (const row of TABLE) {
    process.stdout.write(`Exporting ${row.name} (w=${row.width}) <- ${row.source} ... `)
    try {
      const result = await exportOne(row)
      results.push(result)
      console.log(result.overBudget ? `OVER BUDGET (${result.outBytes}B) — dropped` : `${result.outBytes}B`)
    } catch (err) {
      console.log('FAILED')
      throw err
    }
  }

  console.log('\n=== Size table ===')
  console.log(
    'name'.padEnd(28)
    + 'constants'.padEnd(52)
    + 'w'.padEnd(6)
    + 'src(w x h, bytes, pages)'.padEnd(34)
    + 'out(w x h, bytes, pages)'.padEnd(34)
    + 'status',
  )
  let total = 0
  let keptCount = 0
  for (const r of results) {
    if (!r.overBudget) total += r.outBytes
    else keptCount++
    console.log(
      r.name.padEnd(28)
      + r.constants.join(',').padEnd(52)
      + String(r.width).padEnd(6)
      + `${r.srcWidth}x${r.srcHeight}, ${r.srcBytes}B, ${r.srcPages}p`.padEnd(34)
      + `${r.outWidth}x${r.outHeight}, ${r.outBytes}B, ${r.outPages}p`.padEnd(34)
      + (r.overBudget ? 'DROPPED (over MAX_BYTES, stays on CDN)' : 'kept'),
    )
  }

  console.log(`\nTotal bytes added (kept files only): ${total} (${(total / 1024).toFixed(1)} KB)`)
  if (keptCount) {
    console.log(`${keptCount} output(s) exceeded the MAX_BYTES single-file budget and were dropped — those constants stay on the CDN.`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
