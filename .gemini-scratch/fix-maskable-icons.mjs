/**
 * Fix maskable icons for PWA
 *
 * Problem:  The current maskable icon has rounded corners.
 *           When Android applies its adaptive icon mask, the transparent
 *           corners are filled with white by the OS.
 *
 * Solution: Place the artwork on a full-bleed opaque dark background,
 *           scaled to fit within the 80% safe zone, with NO rounded corners.
 *
 * Outputs:
 *   - public/logos/maskable-icon-512x512.png  (overwrite)
 *   - public/logos/maskable-icon-192x192.png  (new)
 */

import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOGOS_DIR = resolve(__dirname, '../public/logos')

// Background colour — matches the app's dark theme (neutral-900)
const BG_COLOR = { r: 0, g: 0, b: 2, alpha: 1 } // #000002

async function createMaskableIcon(size) {
  const sourceFile = resolve(LOGOS_DIR, 'maskable-icon-512x512.png')
  const outputFile = resolve(LOGOS_DIR, `maskable-icon-${size}x${size}.png`)
  
  // Back up original 512 if this is the first run
  const backupFile = resolve(LOGOS_DIR, 'maskable-icon-512x512.original.png')
  if (size === 512 && !existsSync(backupFile)) {
    copyFileSync(sourceFile, backupFile)
    console.log(`  ✓ Backed up original to maskable-icon-512x512.original.png`)
  }

  // Read the source image metadata to understand its dimensions
  const sourceImage = sharp(sourceFile)
  const metadata = await sourceImage.metadata()
  console.log(`  Source: ${metadata.width}x${metadata.height}, channels: ${metadata.channels}, hasAlpha: ${metadata.hasAlpha}`)

  // The safe zone for maskable icons is the central 80% (radius = 40% from center)
  // So we scale the artwork to 80% of the target size, then center it
  const artworkSize = Math.round(size * 0.80)

  // Resize the source artwork (preserving aspect ratio) to fit in safe zone
  const resizedArtwork = await sharp(sourceFile)
    .resize(artworkSize, artworkSize, {
      fit: 'contain',
      background: BG_COLOR,
    })
    .png()
    .toBuffer()

  // Create a full-bleed opaque canvas, then composite the artwork centered
  const result = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG_COLOR,
    },
  })
    .composite([
      {
        input: resizedArtwork,
        gravity: 'center',
      },
    ])
    // Flatten removes any alpha → fully opaque (critical for maskable)
    .flatten({ background: BG_COLOR })
    .png({ quality: 100 })
    .toFile(outputFile)

  console.log(`  ✓ Created maskable-icon-${size}x${size}.png (${result.width}x${result.height}, ${result.size} bytes)`)
}

async function main() {
  console.log('Fixing maskable icons...\n')

  // Generate both sizes
  await createMaskableIcon(512)
  await createMaskableIcon(192)

  console.log('\n✅ Done! Maskable icons regenerated with full-bleed opaque background.')
  console.log('   Original backed up to maskable-icon-512x512.original.png')
}

main().catch(console.error)
