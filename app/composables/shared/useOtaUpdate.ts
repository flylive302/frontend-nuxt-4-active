import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { CapacitorUpdater, type BundleInfo } from '@capgo/capacitor-updater'
import { evaluateOtaUpdate, type OtaSwapBundle } from '~/utils/ota-gate'

/**
 * OTA live-update orchestrator (capacitor-07 / ADR 0010) — the EXECUTE brain.
 *
 * The Capacitor shell BUNDLES the web app, so without OTA every web change forces
 * a Play Store resubmission. This composable owns the full GATE → EXECUTE → REACT
 * pipeline; the `.client` plugin is a thin INTENT trigger that calls `notifyReady()`
 * first (rollback protection) then `runOtaCheck()`.
 *
 *   GATE    resolve inputs (Capgo `current()`, native `App.getInfo().version`,
 *           R2 `manifest.json`) → the pure `evaluateOtaUpdate` gate decides.
 *   EXECUTE Capgo `download()` → `next()` → `setMultiDelay([{ kind: 'kill' }])`.
 *   REACT   log; every failure is caught and swallowed (an OTA hiccup must never
 *           break app boot).
 *
 * ── apply timing ────────────────────────────────────────────────────────────
 * A `next()`-staged bundle would normally apply on the next *backgrounding* too,
 * which could drop a live-audio user mid-session. We pin apply to `{ kind: 'kill' }`
 * so the swap lands ONLY on a true kill + relaunch (cold start) — the semantics the
 * ADR wanted. No room-state heuristic needed: backgrounding never triggers a swap.
 *
 * All native calls are guarded by `isNativePlatform()`; on the web build every
 * function is a no-op.
 */
export function useOtaUpdate() {
  const log = createLogger('[OTA]')

  /**
   * Confirm to the native layer that JS booted, cancelling the auto-rollback timer.
   * MUST run on every native launch within Capgo's `appReadyTimeout` (10s) or the
   * plugin silently rolls back to the previous bundle. Call this FIRST, before any
   * network work, so a slow manifest fetch can never trip the timeout.
   */
  async function notifyReady(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return
    try {
      await CapacitorUpdater.notifyAppReady()
    } catch (error) {
      log.warn('notifyAppReady failed', error)
    }
  }

  /**
   * INTENT (from the plugin, on launch) → GATE → EXECUTE → REACT.
   * Fire-and-forget: resolves quietly on every skip/error path.
   */
  async function runOtaCheck(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return

    // ── GATE ──────────────────────────────────────────────────────────────
    const manifestUrl = useRuntimeConfig().public.otaManifestUrl
    if (!manifestUrl) {
      log.debug('no manifest URL configured — OTA disabled')
      return
    }

    let manifest: unknown
    try {
      // `cache: 'no-store'` is load-bearing: the manifest is the ONE file whose
      // freshness the whole mechanism depends on — a stale WebView/CDN copy means
      // nothing ever swaps, with no error anywhere. Versioned zips stay cacheable.
      manifest = await $fetch(manifestUrl, { responseType: 'json', timeout: 8000, cache: 'no-store' })
    } catch (error) {
      log.warn('manifest fetch failed', error)
      return
    }

    let installedBundleVersion: string
    let nativeShellVersion: string
    try {
      const [current, appInfo] = await Promise.all([CapacitorUpdater.current(), App.getInfo()])
      installedBundleVersion = current.bundle.version
      nativeShellVersion = appInfo.version
    } catch (error) {
      log.warn('reading current/native version failed', error)
      return
    }

    const verdict = evaluateOtaUpdate({ installedBundleVersion, nativeShellVersion, manifest })
    if (!verdict.shouldSwap) {
      log.debug('no swap', verdict.reason)
      return
    }

    // Re-stage guard: `current()` keeps reporting the OLD version until a staged
    // bundle actually applies (on next kill), so the gate would say "newer" and
    // re-download the same zip every launch. Skip if already queued.
    try {
      const pending = await CapacitorUpdater.getNextBundle()
      if (pending && pending.version === verdict.bundle.version) {
        log.debug('bundle already staged', pending.version)
        return
      }
    } catch (error) {
      log.warn('getNextBundle failed — proceeding', error)
    }

    // ── EXECUTE ───────────────────────────────────────────────────────────
    await stageBundle(verdict.bundle)
  }

  /** EXECUTE: download the bundle, queue it, and pin apply to next kill+relaunch. */
  async function stageBundle(bundle: OtaSwapBundle): Promise<void> {
    let downloaded: BundleInfo
    try {
      downloaded = await CapacitorUpdater.download({
        url: bundle.url,
        version: bundle.version,
        checksum: bundle.checksum,
      })
    } catch (error) {
      log.error('bundle download failed', error)
      return
    }

    try {
      await CapacitorUpdater.next({ id: downloaded.id })
      // Apply ONLY on a true kill + relaunch — never on backgrounding, so a
      // live-audio session is never dropped mid-swap.
      await CapacitorUpdater.setMultiDelay({ delayConditions: [{ kind: 'kill' }] })
    } catch (error) {
      log.error('staging bundle failed', error)
      return
    }

    // ── REACT ─────────────────────────────────────────────────────────────
    log.info(`staged bundle ${downloaded.version} — applies on next app restart`)
  }

  return { notifyReady, runOtaCheck }
}
