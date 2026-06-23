import { describe, it, expect } from 'vitest'
import {
  evaluateOtaUpdate,
  type OtaManifest,
  type OtaVerdict,
} from '../../app/utils/ota-gate'

// A well-formed v1 manifest; individual cases override single fields.
const baseManifest: OtaManifest = {
  bundleVersion: '1.2.0',
  url: 'https://ota.flyliveapp.com/bundles/1.2.0/dist.zip',
  checksum: 'abc123',
  minNativeShellVersion: '1.0.0',
}

const manifest = (over: Partial<OtaManifest> = {}): OtaManifest => ({ ...baseManifest, ...over })

describe('evaluateOtaUpdate — the four AC cases (capacitor-07)', () => {
  it('newer + native-compatible → swap on next launch with bundle coords', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.1.0',
      nativeShellVersion: '1.0.0',
      manifest: manifest(),
    })

    expect(verdict).toEqual<OtaVerdict>({
      shouldSwap: true,
      applyOn: 'next-launch',
      bundle: { version: '1.2.0', url: baseManifest.url, checksum: 'abc123' },
    })
  })

  it('bundle requires a newer native shell than installed → ignored', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.1.0',
      nativeShellVersion: '1.0.0',
      manifest: manifest({ bundleVersion: '2.0.0', minNativeShellVersion: '1.1.0' }),
    })

    expect(verdict).toEqual({ shouldSwap: false, reason: 'native-incompatible' })
  })

  it('equal version → noop', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.2.0',
      nativeShellVersion: '1.0.0',
      manifest: manifest({ bundleVersion: '1.2.0' }),
    })

    expect(verdict).toEqual({ shouldSwap: false, reason: 'not-newer' })
  })

  it('downgrade → ignored', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.3.0',
      nativeShellVersion: '1.0.0',
      manifest: manifest({ bundleVersion: '1.2.0' }),
    })

    expect(verdict).toEqual({ shouldSwap: false, reason: 'not-newer' })
  })
})

describe('evaluateOtaUpdate — native-compat boundary', () => {
  it('bundle requiring exactly the installed shell version → swap (>= passes)', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.1.0',
      nativeShellVersion: '1.4.0',
      manifest: manifest({ bundleVersion: '1.2.0', minNativeShellVersion: '1.4.0' }),
    })

    expect(verdict.shouldSwap).toBe(true)
  })

  it('newer native shell than required → swap', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.1.0',
      nativeShellVersion: '2.0.0',
      manifest: manifest({ bundleVersion: '1.2.0', minNativeShellVersion: '1.4.0' }),
    })

    expect(verdict.shouldSwap).toBe(true)
  })
})

describe('evaluateOtaUpdate — semver is segment-wise, not string compare', () => {
  it('1.10.0 is newer than 1.9.0 (string compare would get this wrong)', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.9.0',
      nativeShellVersion: '1.0.0',
      manifest: manifest({ bundleVersion: '1.10.0' }),
    })

    expect(verdict.shouldSwap).toBe(true)
  })

  it('1.9.0 is NOT newer than 1.10.0', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.10.0',
      nativeShellVersion: '1.0.0',
      manifest: manifest({ bundleVersion: '1.9.0' }),
    })

    expect(verdict).toEqual({ shouldSwap: false, reason: 'not-newer' })
  })

  it('native-compat guard also uses segment-wise compare (shell 1.10.0 satisfies min 1.9.0)', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: '1.1.0',
      nativeShellVersion: '1.10.0',
      manifest: manifest({ bundleVersion: '1.2.0', minNativeShellVersion: '1.9.0' }),
    })

    expect(verdict.shouldSwap).toBe(true)
  })

  it('tolerates a leading "v" prefix and trailing build metadata', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: 'v1.1.0',
      nativeShellVersion: '1.0.0+42',
      manifest: manifest({ bundleVersion: 'v1.2.0', minNativeShellVersion: '1.0.0' }),
    })

    expect(verdict.shouldSwap).toBe(true)
  })
})

describe('evaluateOtaUpdate — fresh install sentinel', () => {
  it('non-semver installed version (e.g. "builtin") sorts lowest → any valid bundle is newer', () => {
    const verdict = evaluateOtaUpdate({
      installedBundleVersion: 'builtin',
      nativeShellVersion: '1.0.0',
      manifest: manifest({ bundleVersion: '1.0.1' }),
    })

    expect(verdict.shouldSwap).toBe(true)
  })
})

describe('evaluateOtaUpdate — malformed manifest is a safe no-swap, never a throw', () => {
  const malformed: Array<{ name: string; manifest: unknown }> = [
    { name: 'null', manifest: null },
    { name: 'undefined', manifest: undefined },
    { name: 'a string', manifest: 'not-an-object' },
    { name: 'an array', manifest: [] },
    { name: 'empty object', manifest: {} },
    { name: 'missing minNativeShellVersion', manifest: { bundleVersion: '2.0.0', url: 'u', checksum: 'c' } },
    { name: 'missing url', manifest: { bundleVersion: '2.0.0', checksum: 'c', minNativeShellVersion: '1.0.0' } },
    { name: 'missing checksum', manifest: { bundleVersion: '2.0.0', url: 'u', minNativeShellVersion: '1.0.0' } },
    { name: 'empty-string field', manifest: manifest({ checksum: '' }) },
    { name: 'non-string version', manifest: { bundleVersion: 2, url: 'u', checksum: 'c', minNativeShellVersion: '1.0.0' } },
  ]

  for (const { name, manifest: bad } of malformed) {
    it(`${name} → no swap, reason malformed-manifest`, () => {
      const verdict = evaluateOtaUpdate({
        installedBundleVersion: '1.0.0',
        nativeShellVersion: '1.0.0',
        manifest: bad,
      })

      expect(verdict).toEqual({ shouldSwap: false, reason: 'malformed-manifest' })
    })
  }
})
