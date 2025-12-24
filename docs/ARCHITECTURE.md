# Frontend Architecture Overview

This document describes the key architectural patterns used in this Nuxt 4 SPA.

## Core Patterns

### 1. Module-Level Singleton Composables

For WebRTC and socket connections, we use **module-level state** to share a single connection across all components:

```typescript
// Module-level (outside function)
const socket = shallowRef<Socket | null>(null);
const device = ref<Device | null>(null);

export function useMediasoup() {
  // All callers share the same socket/device
  return { socket, device, ... };
}
```

**Why?** WebRTC requires exactly one connection per client. If each component had its own ref, joining a room from different components would create multiple connections.

**Files using this pattern:**
- `composables/useMediasoup.ts` - WebRTC device/transports
- `composables/useAudioSocket.ts` - Socket.IO connection
- `composables/useGiftData.ts` - Gift cache
- `composables/useGiftAssetCache.ts` - Animation cache

### 2. Lazy-Loaded Components

Heavy room components are lazy-loaded to reduce initial bundle:

```typescript
// app/app.vue
const RoomShell = defineAsyncComponent(() => 
  import('~/components/room/shell.vue')
)
```

### 3. Type-Safe Color Props

Custom Nuxt UI colors are typed in `types/nuxt-ui.d.ts`:

```typescript
export type AppColor = 'primary' | 'secondary' | 'tertiary' | ...
```

### 4. Error Handling Pattern

API composables expose `error` state and `retry()` functions:

```typescript
const { gifts, hasError, retry } = useGiftData();

// In template:
<UAlert v-if="hasError" @click="retry">Retry</UAlert>
```

## Directory Structure

```
app/
├── composables/     # Shared logic (useApi, useRoom, useMediasoup)
├── stores/          # Pinia stores (room, auth, gift)
├── types/           # TypeScript definitions
├── components/
│   └── room/        # Room-specific components (lazy-loaded)
└── pages/           # File-based routing
```

## Audio System Flow

```
User joins room
    ↓
useRoomAudio.joinRoom()
    ↓
useAudioSocket.connect()     ← Shared singleton
    ↓
socket.emit('room:join')
    ↓
useMediasoup.loadDevice()    ← Shared singleton
    ↓
createTransports() → startAudio()
```

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `composables/useRoomAudio.ts` | 795 | Room orchestration |
| `composables/useMediasoup.ts` | 463 | WebRTC client |
| `stores/room.ts` | 348 | Room state |
| `stores/gift.ts` | 290 | Gift selection/playback |
