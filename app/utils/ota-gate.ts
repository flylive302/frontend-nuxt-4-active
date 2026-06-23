/**
 * OTA live-update gate — pure, framework-agnostic (capacitor-07 / ADR 0010).
 *
 * The Capacitor shell BUNDLES the web app inside the APK, so without OTA every
 * web change forces a Play Store resubmission. Capgo (`@capgo/capacitor-updater`)
 * is the **transport only**; this pure gate makes every swap decision, which is
 * the whole reason it is unit-testable independent of a device (closes AC #1).
 *
 * The gate takes three already-resolved inputs and returns a verdict:
 *
 *   - `installedBundleVersion` — the version of the web bundle currently running
 *     (Capgo `current()`); may be a non-semver sentinel like `builtin` on a fresh
 *     install, in which case any valid remote bundle is "newer".
 *   - `nativeShellVersion` — the Android `versionName`, read from the NATIVE layer
 *     (`App.getInfo().version`), NEVER a constant baked into the web bundle. A
 *     baked value would travel *with* the swapped bundle and always "match", so
 *     the native-compat guard could never fire. That guard is also the Apple
 *     3.3.2 / Google line (a native change must go through the store) — load-bearing
 *     twice.
 *   - `manifest` — the raw, UNTRUSTED `manifest.json` fetched from R2. The gate is
 *     the single validation point: a malformed/partial manifest yields a safe
 *     no-swap, never a throw.
 *
 * Verdict is a discriminated union: a swap carries exactly the validated fields
 * the EXECUTE layer (`useOtaUpdate`) needs to call `download({ url, version,
 * checksum })`; a skip carries a `reason` for logging and test assertions.
 *
 * `applyOn` is always `'next-launch'`: the executor stages with Capgo `next()`,
 * never `set()` (which is a terminal immediate reload). NOTE: Capgo applies a
 * `next()`-staged bundle on the next **backgrounding** as well as cold start —
 * the timing of *when to stage* is the executor's concern, not the gate's.
 *
 * No Vue, no Capacitor, no `$fetch` — just validation + a segment-wise semver
 * compare, so the whole file is pure and fully unit-testable, mirroring
 * `utils/fgs-policy.ts`. The impure transport that downloads/stages bundles lives
 * in `composables/.../useOtaUpdate.ts` and consumes only this verdict.
 */

/** The v1 self-hosted manifest served as static `manifest.json` on R2. */
export interface OtaManifest {
  /** Semver of the published web bundle. */
  bundleVersion: string;
  /** Absolute URL of the bundle `.zip` (also on R2). */
  url: string;
  /** Integrity checksum passed straight to Capgo `download({ checksum })`. */
  checksum: string;
  /** Minimum native `versionName` this bundle requires. Higher than the installed shell ⇒ ignored. */
  minNativeShellVersion: string;
}

/** Why a swap was declined — surfaced to REACT logging and asserted in tests. */
export type OtaSkipReason =
  /** Manifest was null / not an object / missing or non-string required fields. */
  | 'malformed-manifest'
  /** Remote bundle is the same version as installed, or older. */
  | 'not-newer'
  /** Remote bundle requires a newer native shell than is installed. */
  | 'native-incompatible';

/** The bundle coordinates the executor needs to download + stage. */
export interface OtaSwapBundle {
  version: string;
  url: string;
  checksum: string;
}

/** The gate's decision. */
export type OtaVerdict =
  | { shouldSwap: false; reason: OtaSkipReason }
  | { shouldSwap: true; applyOn: 'next-launch'; bundle: OtaSwapBundle };

/** The gate's only input — all three already resolved by the caller. */
export interface OtaGateInput {
  /** Version of the bundle currently running (Capgo `current()`); may be a non-semver sentinel. */
  installedBundleVersion: string;
  /** Native Android `versionName` from `App.getInfo().version`. */
  nativeShellVersion: string;
  /** Raw, untrusted manifest fetched from R2 — validated here. */
  manifest: unknown;
}

/**
 * Pure: decide whether to swap to the remote bundle.
 *
 *   newer + native-compatible → swap (apply on next launch)
 *   native-incompatible       → skip ('native-incompatible')
 *   equal / downgrade         → skip ('not-newer')
 *   malformed manifest        → skip ('malformed-manifest')
 */
export function evaluateOtaUpdate({
  installedBundleVersion,
  nativeShellVersion,
  manifest,
}: OtaGateInput): OtaVerdict {
  const valid = parseManifest(manifest);
  if (!valid) return { shouldSwap: false, reason: 'malformed-manifest' };

  // Must be strictly newer than what we run. An unparseable installed version
  // (e.g. `builtin` on first launch) is treated as the lowest possible, so any
  // valid remote bundle counts as newer.
  if (compareSemver(valid.bundleVersion, installedBundleVersion) <= 0) {
    return { shouldSwap: false, reason: 'not-newer' };
  }

  // Native-compat guard: a bundle requiring a higher shell than installed is
  // ignored on the older shell (no crash, stays put).
  if (compareSemver(valid.minNativeShellVersion, nativeShellVersion) > 0) {
    return { shouldSwap: false, reason: 'native-incompatible' };
  }

  return {
    shouldSwap: true,
    applyOn: 'next-launch',
    bundle: { version: valid.bundleVersion, url: valid.url, checksum: valid.checksum },
  };
}

/** Validate the untrusted manifest into a typed shape, or `null` if malformed. */
function parseManifest(manifest: unknown): OtaManifest | null {
  if (manifest === null || typeof manifest !== 'object') return null;
  const m = manifest as Record<string, unknown>;

  const fields: (keyof OtaManifest)[] = ['bundleVersion', 'url', 'checksum', 'minNativeShellVersion'];
  for (const f of fields) {
    if (typeof m[f] !== 'string' || (m[f] as string).length === 0) return null;
  }

  return {
    bundleVersion: m.bundleVersion as string,
    url: m.url as string,
    checksum: m.checksum as string,
    minNativeShellVersion: m.minNativeShellVersion as string,
  };
}

/**
 * Pure segment-wise semver compare (returns <0, 0, >0). Compares the numeric
 * `major.minor.patch` core only — Android `versionName` is plain `x.y.z`, so
 * prerelease/build metadata is out of scope and ignored. This is deliberately
 * NOT a string compare: `1.10.0` correctly sorts above `1.9.0`. Any unparseable
 * or missing segment is treated as 0, so a sentinel like `builtin` sorts lowest.
 */
function compareSemver(a: string, b: string): number {
  const pa = parseCore(a);
  const pb = parseCore(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

/** Parse the `major.minor.patch` core into a 3-tuple of non-negative ints. */
function parseCore(version: string): [number, number, number] {
  // Drop any leading `v` and trailing prerelease/build (`-`/`+`) before splitting.
  const core = version.replace(/^v/, '').split(/[-+]/)[0] ?? '';
  const parts = core.split('.');
  const seg = (i: number): number => {
    const n = Number.parseInt(parts[i] ?? '', 10);
    return Number.isNaN(n) || n < 0 ? 0 : n;
  };
  return [seg(0), seg(1), seg(2)];
}
