#!/usr/bin/env node
/**
 * OTA bundle publisher (capacitor-07 / ADR 0010).
 *
 * Zips the freshly-generated static web bundle, uploads it to Cloudflare R2, and
 * rewrites the static `manifest.json` the app fetches on launch. The pure gate in
 * `app/utils/ota-gate.ts` makes the swap decision from this manifest; we only
 * host raw artifacts here (Capgo is the download transport, not the decider).
 *
 * Prerequisites (HITL — run `npm run cap:build` first so `.output/public` exists):
 *   - `zip` CLI + AWS CLI installed.
 *   - R2 bucket created; env below set (R2 is S3-compatible).
 *
 * Env:
 *   R2_ENDPOINT          e.g. https://<accountid>.r2.cloudflarestorage.com
 *   R2_BUCKET            e.g. flylive-ota
 *   OTA_PUBLIC_BASE_URL  public base the app reaches, e.g. https://ota.flyliveapp.com
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY  R2 API token
 *
 * Usage:
 *   node scripts/ota-publish.mjs <bundleVersion> <minNativeShellVersion>
 *   # bundleVersion       — semver of THIS web bundle, e.g. 1.4.0
 *   # minNativeShellVersion — lowest native versionName that may run it, e.g. 1.0.0
 *     (bump this only when the bundle needs a native capability shipped in a newer
 *      store release — otherwise keep it at the current floor so all shells swap.)
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [bundleVersion, minNativeShellVersion] = process.argv.slice(2)
if (!bundleVersion || !minNativeShellVersion) {
  console.error('usage: node scripts/ota-publish.mjs <bundleVersion> <minNativeShellVersion>')
  process.exit(1)
}

// Accept 2- or 3-segment versions: Android `versionName` is often `x.y` (ours is
// "3.0"), and the gate compares segment-wise (`utils/ota-gate.ts`) so both work.
const semver = /^\d+\.\d+(\.\d+)?$/
for (const [name, v] of [['bundleVersion', bundleVersion], ['minNativeShellVersion', minNativeShellVersion]]) {
  if (!semver.test(v)) {
    console.error(`✗ ${name} must be x.y or x.y.z, got "${v}"`)
    process.exit(1)
  }
}

const endpoint = process.env.R2_ENDPOINT
const bucket = process.env.R2_BUCKET
const publicBase = process.env.OTA_PUBLIC_BASE_URL
if (!endpoint || !bucket || !publicBase) {
  console.error('✗ set R2_ENDPOINT, R2_BUCKET and OTA_PUBLIC_BASE_URL')
  process.exit(1)
}

const webDir = '.output/public'
if (!existsSync(join(webDir, 'index.html'))) {
  console.error(`✗ ${webDir}/index.html not found — run \`npm run cap:build\` first`)
  process.exit(1)
}

const zipName = `bundle-${bundleVersion}.zip`
const zipPath = join(tmpdir(), zipName)

// Preflight: the system `zip` is required (battle-tested; avoids a hand-rolled
// archiver that could produce a bundle Capgo can't unpack on device).
try {
  execFileSync('zip', ['-v'], { stdio: 'ignore' })
} catch {
  console.error('✗ `zip` not found — install it once: sudo apt-get install -y zip')
  process.exit(1)
}

// 1. Zip the bundle. `index.html` MUST be at the zip root (hence `cd` into webDir);
//    Capgo also requires NO hidden files/folders in the archive, so exclude dotfiles.
rmSync(zipPath, { force: true }) // `zip` APPENDS to an existing file — start clean.
console.log(`→ zipping ${webDir} → ${zipName}`)
execFileSync('zip', ['-qr', zipPath, '.', '-x', '.*', '-x', '*/.*'], { cwd: webDir, stdio: 'inherit' })

// 2. Integrity checksum — SHA-256 hex of the zip, verified by Capgo on download.
const checksum = createHash('sha256').update(readFileSync(zipPath)).digest('hex')
console.log(`→ sha256 ${checksum}`)

// 3. Upload zip, then manifest (manifest LAST so clients never see it point at a
//    zip that isn't uploaded yet).
const r2 = (src, key, contentType, cacheControl) =>
  execFileSync(
    'aws',
    [
      's3', 'cp', src, `s3://${bucket}/${key}`,
      '--endpoint-url', endpoint,
      '--content-type', contentType,
      '--cache-control', cacheControl,
    ],
    { stdio: 'inherit' },
  )

// Versioned zip is immutable → cache hard.
console.log(`→ uploading ${zipName}`)
r2(zipPath, zipName, 'application/zip', 'public, max-age=31536000, immutable')

const manifest = {
  bundleVersion,
  url: `${publicBase.replace(/\/$/, '')}/${zipName}`,
  checksum,
  minNativeShellVersion,
}
const manifestPath = join(tmpdir(), 'manifest.json')
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
// Manifest MUST stay fresh — a stale copy (WebView/CDN) means nothing ever swaps.
console.log(`→ uploading manifest.json`)
r2(manifestPath, 'manifest.json', 'application/json', 'no-cache')

console.log(`\n✓ published bundle ${bundleVersion} — installed apps swap on next restart`)
console.log(JSON.stringify(manifest, null, 2))
