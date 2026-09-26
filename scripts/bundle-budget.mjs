#!/usr/bin/env node
/**
 * Cold-start entry-chunk bundle budget (boot-and-asset-delivery/08).
 *
 * Measures the JS + CSS every fresh session must download and parse before
 * the app can start routing, and fails (exit 1) above a budget.
 *
 * This repo has TWO build outputs and they are NOT interchangeable:
 *
 *   - `npm run build` → `nitro.preset: 'cloudflare-pages'` (nuxt.config.ts) →
 *     writes to **`dist/`** (verified against
 *     `node_modules/nitropack/dist/presets/cloudflare/preset.mjs`:
 *     `output: { dir: "{{ rootDir }}/dist" }`). This IS the real web/CF
 *     Pages artifact. It has **no static `index.html`** — routes are served
 *     per-request by `dist/_worker.js` (a Cloudflare Pages Function), which
 *     picks scripts/styles at request time from a precomputed Vite/Nitro
 *     client manifest baked into
 *     `dist/_worker.js/chunks/build/client.precomputed.mjs`
 *     (`export { s as default }`, `{ dependencies: { <entry-id>: { scripts,
 *     styles, dynamicImports, ... } } }`). That manifest is this script's
 *     primary source for `dist/` — there is nothing else to scan there.
 *
 *   - `npm run cap:build` → `NITRO_PRESET=static nuxt generate` → writes to
 *     **`.output/public`** (matches `capacitor.config.ts` `webDir`). Fully
 *     prerendered static HTML per route (Capacitor has no server), so
 *     `.output/public/index.html` DOES reference the entry chunk directly
 *     via `<script type="module">` / `<link rel="modulepreload">` — used as
 *     the fallback source when only this build exists.
 *
 * (frontend-nuxt-4-active/CLAUDE.md's "web build output is dist/" is
 * correct for `npm run build` — confirmed against the preset source above.)
 *
 * Neither path uses the `rollup-plugin-visualizer` output (`NUXT_ANALYZE=true`
 * → `.nuxt/bundle-stats.html`): that is a treemap for a human, opt-in, and
 * not emitted by a normal build. The client-precomputed manifest is Nitro's
 * own machine-readable "already-wired" manifest and is preferred wherever it
 * exists.
 *
 * Usage (run AFTER a build — this script does not build anything):
 *   npm run build             && npm run bundle:budget           # web (dist/)
 *   npm run cap:build         && npm run bundle:budget           # native (.output/public)
 *   npm run bundle:budget -- --dir dist        # force a specific build dir
 *
 * If both `dist/` and `.output/public` exist (e.g. stale leftovers from
 * different build commands), the one with the NEWER mtime is used by
 * default and both timestamps are printed — never a silent guess.
 *
 * Exit codes: 0 = under budget, 1 = over budget, 2 = no build output found /
 * nothing could be measured (NOT a silent pass).
 *
 * NOT wired into `build`/`postbuild`: that would fail deploys on this
 * unmeasured placeholder threshold. Wire it in only after BUNDLE_BUDGET_*
 * below are set from a real measured baseline, and only into whatever CI
 * actually runs the frontend build (there isn't one in this repo today —
 * see the CI note in the ticket report).
 */

import { gzipSync } from 'node:zlib'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ========================================
// Budget (raw + gzip, of the entry set: entry script + its CSS, i.e. what
// blocks first paint — NOT `dynamicImports`, which are lazy by design)
// ========================================
// Measured 2026-09-26 on `npm run build` (dist/, boot-and-asset-delivery 08, dotlottie
// already lazy): entry script 759.3KB raw / 251.9KB gzip + entry CSS 272.2KB / 35.8KB =
// 1031.5KB raw / 287.7KB gzip. Budgets sit ~10% above that, so an accidental eager import
// of a heavy lib (mediasoup, hls, svga, lottie are each 100KB+) trips it. Raise them
// deliberately, with the new measurement, when growth is intended.
const BUNDLE_BUDGET_RAW_KB = 1150
const BUNDLE_BUDGET_GZIP_KB = 320

const argDirIndex = process.argv.indexOf('--dir')
const forcedDir = argDirIndex !== -1 ? process.argv[argDirIndex + 1] : null

/** Absolute path to `dist/_worker.js/chunks/build/client.precomputed.mjs`, or null. */
function findManifestPath(dir) {
    const manifestPath = join(dir, '_worker.js/chunks/build/client.precomputed.mjs')
    return existsSync(manifestPath) ? manifestPath : null
}

function findIndexHtmlPath(dir) {
    const indexPath = join(dir, 'index.html')
    return existsSync(indexPath) ? indexPath : null
}

/** A dir "exists as a build" if it has either source this script knows how to read. */
function isUsableBuildDir(dir) {
    return existsSync(dir) && (findManifestPath(dir) !== null || findIndexHtmlPath(dir) !== null)
}

function pickBuildDir() {
    if (forcedDir) {
        const dir = resolve(ROOT, forcedDir)
        if (!isUsableBuildDir(dir)) return null
        return dir
    }

    const candidates = ['dist', '.output/public']
        .map((c) => resolve(ROOT, c))
        .filter(isUsableBuildDir)

    if (candidates.length === 0) return null
    if (candidates.length === 1) return candidates[0]

    // Both exist (e.g. leftovers from two different build commands) — use
    // whichever is freshest, and say so, rather than silently picking one.
    const [dirA, dirB] = candidates
    const newer = statSync(dirA).mtimeMs >= statSync(dirB).mtimeMs ? dirA : dirB
    console.log(`[bundle:budget] Both ${dirA} and ${dirB} exist — using the newer one: ${newer} (pass --dir to force).`)
    return newer
}

/** Find the manifest's entry node: the one script anywhere with isEntry === true. */
function findEntryFromManifest(manifest) {
    for (const dep of Object.values(manifest.dependencies ?? {})) {
        for (const script of Object.values(dep.scripts ?? {})) {
            if (script.isEntry) return script
        }
    }
    return null
}

async function measureFromManifest(buildDir, manifestPath) {
    const mod = await import(pathToFileURL(manifestPath).href)
    const manifest = mod.default
    const entry = findEntryFromManifest(manifest)
    if (!entry) {
        console.error(`[bundle:budget] ${manifestPath} has no script with isEntry:true — manifest shape may have changed.`)
        return null
    }

    const relFiles = [entry.file, ...(entry.css ?? [])].filter(Boolean)
    return relFiles.map((f) => measureChunk(join(buildDir, '_nuxt'), f)).filter((c) => c !== null)
}

const ENTRY_JS_TAG_RE = /<(?:script[^>]*\stype="module"[^>]*\ssrc|link[^>]*\srel="modulepreload"[^>]*\shref)="([^"]+\.(?:js|css))"/g
const ENTRY_CSS_LINK_RE = /<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+\.css)"/g

function measureFromIndexHtml(buildDir, indexHtmlPath) {
    const html = readFileSync(indexHtmlPath, 'utf8')
    const urls = new Set()
    for (const match of html.matchAll(ENTRY_JS_TAG_RE)) urls.add(match[1])
    for (const match of html.matchAll(ENTRY_CSS_LINK_RE)) urls.add(match[1])

    if (urls.size === 0) {
        console.error(`[bundle:budget] Found ${indexHtmlPath} but no <script type="module">/modulepreload/stylesheet tags in it.`)
        return null
    }

    return [...urls].map((url) => measureChunk(buildDir, url)).filter((c) => c !== null)
}

function measureChunk(baseDir, relOrAbsUrl) {
    // Manifest paths are relative to `_nuxt/`; index.html URLs are
    // site-absolute (e.g. "/_nuxt/xyz.js") relative to the build dir root.
    const relPath = relOrAbsUrl.replace(/^\//, '')
    const filePath = join(baseDir, relPath)
    if (!existsSync(filePath)) return null

    const rawBytes = statSync(filePath).size
    const gzipBytes = gzipSync(readFileSync(filePath)).length
    return { url: relOrAbsUrl, filePath, rawBytes, gzipBytes }
}

async function main() {
    const buildDir = pickBuildDir()
    if (!buildDir) {
        console.error(
            `[bundle:budget] No usable build output found (checked: dist/, .output/public/` +
            `${forcedDir ? ` — forced --dir ${forcedDir} was not usable` : ''}).\n` +
            `[bundle:budget] Run "npm run build" (web) or "npm run cap:build" (native) first, then re-run this script.`
        )
        process.exit(2)
    }

    const manifestPath = findManifestPath(buildDir)
    const chunks = manifestPath
        ? await measureFromManifest(buildDir, manifestPath)
        : measureFromIndexHtml(buildDir, findIndexHtmlPath(buildDir))

    if (!chunks || chunks.length === 0) {
        process.exit(2)
    }

    const totalRawKb = chunks.reduce((sum, c) => sum + c.rawBytes, 0) / 1024
    const totalGzipKb = chunks.reduce((sum, c) => sum + c.gzipBytes, 0) / 1024

    console.log(`[bundle:budget] Build dir: ${buildDir} (${manifestPath ? 'client.precomputed.mjs' : 'index.html'} source)`)
    console.log('[bundle:budget] Entry set (cold-start critical path — blocks first paint):')
    for (const c of chunks) {
        console.log(`  ${c.url}  raw=${(c.rawBytes / 1024).toFixed(1)}KB  gzip=${(c.gzipBytes / 1024).toFixed(1)}KB`)
    }
    console.log(`[bundle:budget] Total: raw=${totalRawKb.toFixed(1)}KB (budget ${BUNDLE_BUDGET_RAW_KB}KB), gzip=${totalGzipKb.toFixed(1)}KB (budget ${BUNDLE_BUDGET_GZIP_KB}KB)`)

    const overRaw = totalRawKb > BUNDLE_BUDGET_RAW_KB
    const overGzip = totalGzipKb > BUNDLE_BUDGET_GZIP_KB
    if (overRaw || overGzip) {
        console.error(
            `[bundle:budget] OVER BUDGET — ${overRaw ? `raw +${(totalRawKb - BUNDLE_BUDGET_RAW_KB).toFixed(1)}KB ` : ''}` +
            `${overGzip ? `gzip +${(totalGzipKb - BUNDLE_BUDGET_GZIP_KB).toFixed(1)}KB` : ''}`
        )
        process.exit(1)
    }

    console.log('[bundle:budget] OK — within budget.')
}

main().catch((err) => {
    console.error('[bundle:budget] Unexpected error:', err)
    process.exit(2)
})
