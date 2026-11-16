#!/usr/bin/env node
/**
 * Dev-only fake "Fly Games Ludo" host page server.
 *
 * Serves ONLY `scripts/dev/fake-fly-game/index.html` at `/` (everything else
 * is 404) so a developer can run the game-launch flow locally without the real
 * vendor. Deliberately lives outside `public/` so it never ships in a bundle.
 *
 * Env:
 *   FAKE_FLY_GAME_PORT  default 5175
 *   FAKE_FLY_GAME_HOST  default 0.0.0.0 (reachable from a phone on the LAN)
 *
 * The page must stay embeddable: no X-Frame-Options, no frame-ancestors CSP.
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.FAKE_FLY_GAME_PORT) || 5175
const host = process.env.FAKE_FLY_GAME_HOST || '0.0.0.0'
const pagePath = join(dirname(fileURLToPath(import.meta.url)), 'fake-fly-game', 'index.html')

const server = createServer(async (req, res) => {
  let pathname = ''
  try {
    pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  }
  catch {
    pathname = ''
  }

  if (pathname !== '/' || (req.method !== 'GET' && req.method !== 'HEAD')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end('Not found')
    return
  }

  try {
    const html = await readFile(pagePath)
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': html.length,
    })
    res.end(req.method === 'HEAD' ? undefined : html)
  }
  catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(`Could not read ${pagePath}: ${err instanceof Error ? err.message : String(err)}`)
  }
})

server.on('error', (err) => {
  console.log(`fake-fly-game: server error: ${err.message}`)
  process.exit(1)
})

server.listen(port, host, () => {
  const shown = host === '0.0.0.0' || host === '::' ? 'localhost' : host
  console.log(`FAKE FLY GAME (dev only) listening on http://${shown}:${port}/ (bound to ${host})`)
  console.log('')
  console.log('Reminder:')
  console.log(`  1. Set backend FLY_GAMES_LUDO_ORIGIN=http://<this-host>:${port}  (root of origin, no path)`)
  console.log('     e.g. your LAN IP when testing from a phone.')
  console.log('  2. Put your user id in backend FLY_GAMES_TESTER_USER_IDS.')
})
