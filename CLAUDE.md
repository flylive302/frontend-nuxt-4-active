# Frontend (`frontend-nuxt-4-active/`)

> Moved out of the monorepo root `CLAUDE.md` so it loads only when working in this directory.
> `Architecture.md` at the repo root is canonical for layer rules; if the two disagree, it wins.

Non-obvious commands (the rest are plain `package.json` scripts):

```bash
npm run architecture:check   # validate layer boundaries
```

## Key conventions

- **Nuxt auto-imports** — composables, Vue utilities, and Nuxt utilities do not need explicit imports. New `composables/<subdir>/` must be added to `nuxt.config` `imports.dirs`.
- **Never use console logs** — use `createLogger('[Name]')` from `~/utils/logger`.
- **Never magic numbers** — import from `~/constants/room.ts` (e.g. `DEFAULT_SEAT_COUNT`).
- Browser-only components must use `.client.vue` suffix.
- TypeScript strict mode — no `any`, fully typed props/emits/refs/returns.
- File naming: components/types = PascalCase, composables = `useCamelCase`, files = kebab-case, vars/functions = camelCase, constants = SCREAMING_SNAKE_CASE.
- Vue file section order: Imports → Config → Constants → Types → State → Composables → Handlers → Helpers.

## Directory responsibilities

Deployed via Nitro preset `cloudflare-pages` (set in `nuxt.config.ts`); web build output is `dist/`.

```
app/pages/          → Route binding + data loading ONLY (no business logic)
app/components/     → INTENT: UI markup + call composables (never socket.emit or $fetch)
app/composables/    → Business logic (GATE → EXECUTE → REACT); the "brain"
app/stores/         → Reactive state: ref + computed + setters ONLY (no API calls, no toasts)
app/events/         → REACT: socket.on() → store mutation mapping (no business logic)
app/services/       → Low-level infra (no store imports, no UI concerns)
app/types/          → TypeScript interfaces only (no runtime code)
app/constants/      → Static values (no store/composable imports)
app/utils/          → Pure functions (no Vue reactivity, no store imports)
app/layouts/        → Page layout templates (auth, home, profile, alt)
app/middleware/     → Route guards (auth, guest, profile-completion)
app/plugins/        → Nuxt plugins — real-time bootstrap (socket, echo), media players (.client suffix)
app/assets/         → CSS and static image assets
server/api/         → Nitro server routes (BFF-style, avoids CORS on client)
```

**Composable naming by role** — `use*Sending` / `use*Actions` / `use*Membership` = Action orchestrator ·
`use*Data` / `use*Catalog` = Data/Query · `use*EventHandlers` = socket reactor ·
`use*Audio` / `use*Socket` / `use*Lifecycle` = infrastructure.

See `Architecture.md` for the full ✅/❌ rules on components, stores, composables and events.

## Room music playlist (DJ)

Single-DJ, client-local, ephemeral playlist streamed through the existing mediasoup producer (ADR 0006). Three composed modules, strict GATE→EXECUTE→REACT:

- `utils/playlist-queue.ts` — `PlaylistQueue`: pure ordered-track model (`add`/`remove`/`reorder`/`next`/`prev`); cheap `File` handles only, no Vue/Web Audio/sockets.
- `services/audioPlaybackEngine.ts` — `createAudioPlaybackEngine()`: owns the Web Audio graph + decode. **Stable output `MediaStreamTrack`** built once; track swaps change only the upstream source → `musicProducer` is produced **exactly once**, gapless auto-advance, no re-consume. Bounds resident PCM to current+next.
- `composables/room/audio/useRoomAudioPlayer.ts` — thin orchestrator composing the queue + engine + `useMediasoupStreaming` + MSAB socket coordination. **No raw Web Audio code here.** Owns auto-advance (`engine.onEnded → queue.next()`), owner force-take (`takeover`), and the targeted-`revoked` path.

Owner-only force-take (`audioPlayer:takeover`) overwrites the mutex + revokes the displaced DJ; non-owner admins cannot interrupt. Queue clears only on leave/refresh. Components stay INTENT-only; `player.vue` uses `vue-draggable-plus` for drag-to-reorder.
