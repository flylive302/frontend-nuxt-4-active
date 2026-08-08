#!/usr/bin/env node
/**
 * Country flag SVG generator (frontend-offline-resilience 03 / ADR 0027).
 *
 * Emits one static `public/flags/<code>.svg` per country in
 * `public/countries.json`, extracted from the `@iconify-json/flag` collection.
 *
 * WHY THIS EXISTS RATHER THAN `icon.clientBundle`:
 *   `app/utils/flag-icon.ts` used to build `i-flag-${code}-4x3` at runtime, so
 *   @nuxt/icon's static scan could never see the 245 names and bundled ZERO of
 *   them — every flag resolved live from api.iconify.design. Bundling them
 *   instead costs 1,587 KB raw / 416 KB brotli in an EAGERLY imported chunk
 *   (@nuxt/icon 2.2.2 static-imports the client bundle), i.e. every session
 *   pays for the country picker whether or not it opens. Static files are lazy:
 *   only a flag actually rendered is ever fetched, and on native they ship
 *   inside the APK. See ADR 0027.
 *
 * Usage:
 *   npm run flags:generate            # write public/flags/*.svg
 *   npm run flags:generate -- --check # verify only; exit 1 if out of date
 *
 * Regenerate whenever `public/countries.json` changes or @iconify-json/flag is
 * upgraded. The output IS committed — the build does not run this.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COUNTRIES_JSON = resolve(ROOT, 'public/countries.json')
const FLAG_COLLECTION = resolve(ROOT, 'node_modules/@iconify-json/flag/icons.json')
const OUT_DIR = resolve(ROOT, 'public/flags')

const CHECK_ONLY = process.argv.includes('--check')

/**
 * Country codes that have no counterpart in the flag collection.
 * MUST stay in sync with INVALID_FLAG_CODES in `app/utils/flag-icon.ts`.
 */
const INVALID_FLAG_CODES = new Set(['an'])

/**
 * Country-data code -> flag-collection code, where the two disagree.
 * MUST stay in sync with the remap in `app/utils/flag-icon.ts`.
 */
const CODE_REMAP = { uk: 'gb' }

/** The collection ships 1x1 and 4x3 variants; 4x3 is what the app has always used. */
const VARIANT = '4x3'

/**
 * Rebuild a standalone SVG document from an Iconify icon record.
 *
 * Iconify stores only the icon BODY plus the collection's default viewBox
 * dimensions, so the wrapping <svg> element has to be reconstructed here.
 */
function toSvgDocument(icon, defaults) {
    const width = icon.width ?? defaults.width
    const height = icon.height ?? defaults.height
    const left = icon.left ?? defaults.left ?? 0
    const top = icon.top ?? defaults.top ?? 0

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}">${icon.body}</svg>\n`
}

/** Resolve an icon name through the collection's aliases, if any. */
function resolveIcon(collection, name) {
    const direct = collection.icons?.[name]
    if (direct) return direct

    const alias = collection.aliases?.[name]
    if (alias?.parent) return collection.icons?.[alias.parent] ?? null

    return null
}

async function main() {
    const [countriesRaw, collectionRaw] = await Promise.all([
        readFile(COUNTRIES_JSON, 'utf8'),
        readFile(FLAG_COLLECTION, 'utf8').catch(() => {
            throw new Error(
                '@iconify-json/flag is not installed. Run `npm install` (it is a devDependency).',
            )
        }),
    ])

    const countries = JSON.parse(countriesRaw)
    const collection = JSON.parse(collectionRaw)

    const defaults = {
        width: collection.width ?? 24,
        height: collection.height ?? 24,
        left: collection.left,
        top: collection.top,
    }

    /** code -> svg document, keyed by the code the APP asks for (not the remapped one). */
    const wanted = new Map()
    const missing = []

    for (const country of countries) {
        const code = String(country.code ?? '').toLowerCase().trim()
        if (!code || INVALID_FLAG_CODES.has(code)) continue

        const flagCode = CODE_REMAP[code] ?? code
        const icon = resolveIcon(collection, `${flagCode}-${VARIANT}`)

        if (!icon) {
            missing.push(`${country.name} (${code} -> ${flagCode})`)
            continue
        }

        wanted.set(code, toSvgDocument(icon, defaults))
    }

    if (missing.length > 0) {
        // A code with no flag must be added to INVALID_FLAG_CODES (in BOTH this
        // file and flag-icon.ts) so it falls back to the globe icon, rather than
        // silently shipping a 404.
        throw new Error(
            `No flag in the collection for ${missing.length} code(s):\n  ${missing.join('\n  ')}\n` +
                'Add each to INVALID_FLAG_CODES here AND in app/utils/flag-icon.ts.',
        )
    }

    if (CHECK_ONLY) {
        const existing = await readdir(OUT_DIR).catch(() => [])
        const existingSvgs = existing.filter((f) => f.endsWith('.svg'))
        const problems = []

        if (existingSvgs.length !== wanted.size) {
            problems.push(`file count: have ${existingSvgs.length}, want ${wanted.size}`)
        }

        for (const [code, svg] of wanted) {
            const current = await readFile(resolve(OUT_DIR, `${code}.svg`), 'utf8').catch(() => null)
            if (current === null) {
                problems.push(`missing: ${code}.svg`)
            } else if (hash(current) !== hash(svg)) {
                problems.push(`stale: ${code}.svg`)
            }
        }

        if (problems.length > 0) {
            console.error(`✖ public/flags is out of date:\n  ${problems.join('\n  ')}`)
            console.error('  Run: npm run flags:generate')
            process.exit(1)
        }

        console.log(`✔ public/flags is up to date (${wanted.size} flags).`)
        return
    }

    // Rebuild from scratch so a country removed from countries.json does not
    // leave an orphaned SVG behind.
    await rm(OUT_DIR, { recursive: true, force: true })
    await mkdir(OUT_DIR, { recursive: true })

    let bytes = 0
    for (const [code, svg] of wanted) {
        await writeFile(resolve(OUT_DIR, `${code}.svg`), svg, 'utf8')
        bytes += Buffer.byteLength(svg)
    }

    console.log(
        `✔ Wrote ${wanted.size} flags to public/flags (${(bytes / 1024).toFixed(1)} KB total, ` +
            `${(bytes / wanted.size).toFixed(0)} B average — fetched only when displayed).`,
    )
}

function hash(value) {
    return createHash('sha256').update(value).digest('hex')
}

main().catch((error) => {
    console.error(error.message)
    process.exit(1)
})
