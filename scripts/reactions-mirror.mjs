#!/usr/bin/env node
/**
 * Seat Reactions catalog mirror (seat-reactions 02 / ADR 0015).
 *
 * Does two things:
 *   1. Fetches Google's Noto Emoji Animation catalog metadata and regenerates
 *      the Reaction Manifest at `app/constants/reactions-manifest.ts`
 *      (ordered array of { code, name, category, tags } in Noto catalog order;
 *      base emojis only — skin-tone variants are filtered out).
 *      This ALWAYS runs — the generated file is committed to the repo.
 *      If the catalog site is unreachable (retries exhausted) but the manifest
 *      already exists, the committed manifest is used as the catalog source so
 *      --upload still works offline (new emojis are picked up next time).
 *   2. Optionally mirrors every emoji's `lottie.json` + `512.webp` from
 *      Google's CDN to our ImageKit account under `/emojis/{code}/`
 *      (only with --upload; default is a dry run that prints the plan).
 *
 * Usage:
 *   node scripts/reactions-mirror.mjs               # regenerate manifest + dry-run upload plan
 *   node scripts/reactions-mirror.mjs --upload      # regenerate manifest + actually upload
 *   npm run reactions:mirror                        # same as the first line
 *
 * Env (required only for --upload; same names as backend/config/imagekit.php):
 *   IMAGEKIT_PUBLIC_KEY     ImageKit public API key
 *   IMAGEKIT_PRIVATE_KEY    ImageKit private API key
 *   IMAGEKIT_URL_ENDPOINT   e.g. https://ik.imagekit.io/flylive
 *   (you can put them in .env.reactions and run:
 *    node --env-file=.env.reactions scripts/reactions-mirror.mjs --upload)
 *
 * How to add emojis later:
 *   Google adds emojis to the catalog over time. Just re-run this script with
 *   --upload: it lists what already exists on ImageKit and uploads ONLY the
 *   missing files (idempotent + resumable — safe to re-run after an
 *   interruption), then rewrites the manifest. Ship the new manifest via OTA.
 *
 * Notes:
 *   - Runtime asset URLs are built from REACTION_ASSET_BASE in
 *     `app/constants/assets.ts` (one-line swap back to Google's CDN there).
 *   - No duration data here on purpose: playback duration is read from each
 *     Lottie file at runtime (ADR 0015).
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const CATALOG_URL = 'https://googlefonts.github.io/noto-emoji-animation/data/api.json'
const GOOGLE_ASSET_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'
const IMAGEKIT_FOLDER = '/emojis' // final URLs: {IMAGEKIT_URL_ENDPOINT}/emojis/{code}/lottie.json
const CONCURRENCY = 5 // polite to both Google and ImageKit rate limits
const FILES_PER_EMOJI = ['lottie.json', '512.webp']
/** Fitzpatrick skin-tone modifiers — variant entries are dropped, base emojis only. */
const SKIN_TONE_MODIFIERS = new Set(['1f3fb', '1f3fc', '1f3fd', '1f3fe', '1f3ff'])

/** Codes present in Google's catalog metadata but 404 on their CDN (no animated
 *  assets exist). Verified 2026-07-09: ©️ and ®️. Re-check before removing. */
const KNOWN_MISSING_ASSETS = new Set(['a9_fe0f', 'ae_fe0f'])

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'app/constants/reactions-manifest.ts')

const upload = process.argv.includes('--upload')

// ── 0. Validate env up front (before ANY network work) ───────────────────────
if (upload) {
  const missing = ['IMAGEKIT_PUBLIC_KEY', 'IMAGEKIT_PRIVATE_KEY', 'IMAGEKIT_URL_ENDPOINT']
    .filter(k => !process.env[k])
  if (missing.length > 0) {
    console.error(`✗ --upload needs ImageKit credentials; missing env var(s): ${missing.join(', ')}`)
    console.error('  (same names as backend/config/imagekit.php — see script header for details)')
    process.exit(1)
  }
}

/** fetch with timeout + ~3 attempts + backoff — github.io / gstatic.com can be
 *  unreachable transiently (WSL2 IPv6 ENETUNREACH, ETIMEDOUT, …). */
async function fetchWithRetry(url, { tries = 3, timeoutMs = 20_000 } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err?.cause ?? err
    }
    if (attempt < tries) {
      const delay = 1000 * 2 ** (attempt - 1)
      console.warn(`  … fetch failed (${lastErr.message || lastErr.code || lastErr.name || lastErr}), retrying in ${delay}ms (${attempt}/${tries - 1})`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error(`${url} failed after ${tries} attempts: ${lastErr.message || lastErr.code || lastErr.name || lastErr}`)
}

// ── 1. Fetch catalog (offline fallback: reuse the committed manifest) ────────
let entries
let lastModified = 'unknown'
let manifestIsFresh = false
console.log(`→ fetching Noto Emoji Animation catalog: ${CATALOG_URL}`)
try {
  const res = await fetchWithRetry(CATALOG_URL)
  const catalog = await res.json()
  if (!Array.isArray(catalog.icons) || catalog.icons.length === 0) {
    throw new Error('unexpected catalog shape — expected { icons: [...] }')
  }
  lastModified = res.headers.get('last-modified') ?? 'unknown'
  manifestIsFresh = true

  const total = catalog.icons.length
  const baseIcons = catalog.icons.filter(
    icon => !icon.codepoint.split(/[_-]/).some(cp => SKIN_TONE_MODIFIERS.has(cp))
      && !KNOWN_MISSING_ASSETS.has(icon.codepoint),
  )
  console.log(`→ ${total} catalog entries; ${total - baseIcons.length} dropped (skin-tone variants + known-missing assets) → ${baseIcons.length} base emojis kept`)

  /**
   * Manifest entries, in Noto catalog order (base emojis only).
   * code  — lowercase hex codepoint(s), multi-codepoint joined by "_"
   *         (exactly as used in Google's asset URLs and our ImageKit paths)
   * name  — human-ish name derived from the first tag (":grin-sweat:" → "grin sweat")
   */
  entries = baseIcons.map(icon => ({
    code: icon.codepoint,
    name: (icon.tags[0] ?? icon.name).replace(/:/g, '').replace(/-/g, ' '),
    category: icon.categories[0] ?? 'Other',
    tags: icon.tags.map(t => t.replace(/:/g, '')),
  }))
}
catch (err) {
  if (!existsSync(manifestPath)) {
    console.error(`✗ catalog fetch failed and no committed manifest to fall back to — ${err.message}`)
    process.exit(1)
  }
  console.warn(`⚠ catalog fetch failed — ${err.message}`)
  console.warn(`⚠ falling back to the committed manifest as catalog source: ${manifestPath}`)
  console.warn('⚠ NOTE: new emojis published by Google will be missed until the catalog is reachable again')
  const src = readFileSync(manifestPath, 'utf8')
  const match = src.match(/REACTIONS: readonly ReactionManifestEntry\[\] = (\[[\s\S]*\]) as const/)
  if (!match) {
    console.error('✗ could not parse the REACTIONS array out of the existing manifest')
    process.exit(1)
  }
  entries = JSON.parse(match[1])
  console.log(`→ ${entries.length} entries loaded from committed manifest`)
}

// ── 2. Generate the manifest constants file ──────────────────────────────────
// Skipped in offline-fallback mode: the entries came FROM the manifest, so
// rewriting would only churn the "Generated" timestamp.
if (manifestIsFresh) {
  writeManifest(entries, lastModified)
  console.log(`✓ wrote ${manifestPath}`)
}

function writeManifest(entries, lastModified) {
  const now = new Date().toISOString()
const header = `// GENERATED by scripts/reactions-mirror.mjs — DO NOT EDIT BY HAND.
// Re-run \`node scripts/reactions-mirror.mjs\` to regenerate (see script header).
// Source: ${CATALOG_URL}
// Catalog last-modified: ${lastModified}
// Generated: ${now} — ${entries.length} entries, Noto catalog order.
// Filter: base emojis only — skin-tone variants (1f3fb–1f3ff modifiers) dropped.

/** One entry per Noto animated emoji. Asset URLs are built from
 *  REACTION_ASSET_BASE (app/constants/assets.ts): \`\${base}/\${code}/lottie.json\`
 *  and \`\${base}/\${code}/512.webp\`. */
export interface ReactionManifestEntry {
  /** Lowercase hex codepoint(s); multi-codepoint joined by "_" (e.g. "1faf4_1f3fe"). */
  readonly code: string
  readonly name: string
  readonly category: string
  readonly tags: readonly string[]
}

export const REACTIONS: readonly ReactionManifestEntry[] = `

  writeFileSync(manifestPath, header + JSON.stringify(entries, null, 2) + ' as const\n')
}

if (!upload) {
  console.log(`\n(dry run) would mirror ${entries.length} emojis × ${FILES_PER_EMOJI.length} files`)
  console.log(`(dry run) from ${GOOGLE_ASSET_BASE}/{code}/{file}`)
  console.log(`(dry run) to   ImageKit folder ${IMAGEKIT_FOLDER}/{code}/{file}`)
  console.log('(dry run) sample:')
  for (const e of entries.slice(0, 3)) {
    for (const f of FILES_PER_EMOJI) console.log(`  ${GOOGLE_ASSET_BASE}/${e.code}/${f}  →  ${IMAGEKIT_FOLDER}/${e.code}/${f}`)
  }
  console.log('\nrun with --upload (and ImageKit env vars set) to actually upload')
  process.exit(0)
}

// ── 3. Upload to ImageKit (idempotent: skip files that already exist) ────────
// (env vars already validated at step 0, before any network work)
const { default: ImageKit } = await import('imagekit')
const ik = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
})

// List everything already under /emojis once (paginated) so re-runs skip
// existing files instead of re-uploading ~1,700 assets. This is what makes
// the script resumable: kill it anytime, re-run, it continues where it left off.
console.log(`→ listing existing files under ${IMAGEKIT_FOLDER} …`)
const existing = new Set()
for (let skip = 0; ; skip += 1000) {
  const page = await ik.listFiles({ path: IMAGEKIT_FOLDER, includeFolder: false, limit: 1000, skip })
  for (const f of page) existing.add(f.filePath) // e.g. /emojis/1f600/lottie.json
  if (page.length < 1000) break
}
console.log(`→ ${existing.size} files already on ImageKit`)

const jobs = []
for (const e of entries) {
  for (const file of FILES_PER_EMOJI) {
    const filePath = `${IMAGEKIT_FOLDER}/${e.code}/${file}`
    if (existing.has(filePath)) continue
    jobs.push({ code: e.code, file, filePath })
  }
}
console.log(`→ ${jobs.length} files to upload (${entries.length * FILES_PER_EMOJI.length - jobs.length} skipped, already present)`)

let done = 0
let failed = 0
async function worker() {
  for (;;) {
    const job = jobs.shift()
    if (!job) return
    try {
      const src = await fetchWithRetry(`${GOOGLE_ASSET_BASE}/${job.code}/${job.file}`)
      const buf = Buffer.from(await src.arrayBuffer())
      await ik.upload({
        file: buf,
        fileName: job.file,
        folder: `${IMAGEKIT_FOLDER}/${job.code}`,
        useUniqueFileName: false, // keep deterministic /emojis/{code}/{file} paths
        overwriteFile: false, // belt-and-braces idempotence on top of the skip list
      })
      done++
      if (done % 50 === 0) console.log(`  … ${done}/${done + jobs.length} uploaded`)
    } catch (err) {
      failed++
      console.error(`  ✗ ${job.filePath}: ${err.message}`)
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

console.log(`\n✓ upload finished: ${done} uploaded, ${failed} failed`)
if (failed > 0) {
  console.error('re-run the script to retry failed files (existing ones are skipped)')
  process.exit(1)
}
