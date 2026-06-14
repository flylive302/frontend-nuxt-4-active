# Capacitor native shell (Android) — build & run

The Nuxt SPA is **bundled** into the APK (no `server.url`). See [ADR 0010](../docs/adr/0010-capacitor-native-shell.md).

## One-time setup (your machine — needs Android toolchain)

Requires **Android Studio** (SDK + platform-tools) and **JDK 21**. This repo's CI/WSL box
has no Android SDK, so the APK must be built where Android Studio is installed.

```bash
cp .env.capacitor.example .env.capacitor   # then fill in REMOTE backend URLs
```

> ⚠️ **Line endings:** `.env.capacitor` must use **LF**, not CRLF. If you edit it on
> Windows and it gets saved CRLF, Nuxt's dotenv parser silently fails to load it and the
> build falls back to `localhost` defaults. Normalize with `sed -i 's/\r$//' .env.capacitor`.
>
> Note: `cap:build` forces `NITRO_PRESET=static` so the bundle lands in `.output/public`
> (matching `webDir`). Do NOT run a plain `nuxt generate` for Capacitor — the repo's
> default `cloudflare-pages` preset writes to `dist`, which `cap sync` would ignore.

> ⚠️ The `NUXT_PUBLIC_*` URLs are **baked into the bundle at generate time**. If any
> still point at `localhost`, the app installs but cannot load rooms, connect sockets,
> or produce audio. Set all four groups (REST `apiBase`/`apiRoot`, `audioServerUrl`,
> `reverb*`) to reachable remote/staging values.

## Backend preconditions (REQUIRED — the app runs from origin `https://localhost`)

The native app is **not** served from your web domain. On Android the WebView origin is
`https://localhost`, so every authenticated REST call and every WS handshake is
cross-origin. Without these, login fails before the user reaches a room:

1. **Laravel REST CORS** — already handled: `backend/config/cors.php` now allows
   `https://localhost` and `capacitor://localhost` via `allowed_origins_patterns`.
2. **Laravel Reverb** — set `REVERB_APP_ALLOWED_ORIGINS` to include `localhost`
   (or keep the `*` default in non-prod).
3. **MSAB** — add `https://localhost` to the `CORS_ORIGINS` env on the audio server.

> Note: `CapacitorHttp` can proxy REST `fetch` through native (bypassing CORS) but does
> **not** cover the Socket.IO / Reverb / mediasoup WS handshakes — those servers must
> accept the native origin regardless. Allowlisting (above) is the simpler path.

## Build the web bundle + sync into the native project

```bash
npm run cap:build      # nuxt generate --dotenv .env.capacitor  +  cap sync android
```

`cap:sync` / `cap:android` are also available to re-sync or open Android Studio:

```bash
npm run cap:sync       # copy latest .output/public into android/ (no regenerate)
npm run cap:android    # open the android/ project in Android Studio
```

## Produce & install a debug APK

```bash
cd android && ./gradlew assembleDebug
# APK at: android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## On-device verification checklist (AC 2, 4, 6)

- [ ] APK installs and launches on a physical Android device
- [ ] Home screen lists rooms (BFF `/api/rooms` repointed to `apiBase`)
- [ ] Country detection resolves (BFF `/api/detect-country` → geojs.io; confirm geojs
      sends `Access-Control-Allow-Origin: *` from the `capacitor://localhost` origin)
- [ ] Log in → join a room → hear other speakers (mediasoup + Reverb connect to remote)
- [ ] Tapping to speak shows the **mic permission prompt** and, once granted, produces audio

## How the BFF was repointed (no composable changes)

`app/plugins/native-api-shim.client.ts` wraps the global `$fetch` on native platforms
only and rewrites the two relative BFF paths:

- `/api/rooms` → `${apiBase}/rooms`
- `/api/detect-country` → geojs.io, remapping `{ country }` → `{ country_code }`

On web this plugin no-ops and the Nitro routes serve as before.
