import { defineStore } from 'pinia';
import type { BootstrapRoom as Room } from '~/types/user/bootstrap';
import { ROOM_SESSION_STORAGE_KEY } from '~/constants/persistence';
import { legacyCookieSeed, seededLocalStorage } from '~/services/seededLocalStorage';

// ============================================
// Store
// ============================================
/**
 * The PERSISTED half of room state, split out of `roomStore` by lifecycle
 * (ticket 12, android-client-performance).
 *
 * Why a separate store: Pinia's `$subscribe` is `{ deep: true }` over the whole
 * store, so while these keys lived next to `currentRoom` every gift (which
 * mutates `currentRoom.room_xp`, an UNPICKED key) still deep-walked, serialised
 * and re-wrote the cookie. Keeping the hot in-memory room out of any persisted
 * store is the fix — do not move `currentRoom` in here.
 *
 * Cross-store coordination (minimize / enter / leave touching both stores)
 * lives in `useRoomSession()`, never here.
 */
export const useRoomSessionStore = defineStore('roomSession', () => {
  const userRoom = ref<Room | null>(null);
  const previousRoute = ref('/');

  /**
   * Snapshot of a minimized room. Distinct from `roomStore.currentRoom`
   * (in-memory only) on purpose: it survives a cold start so the mini-player
   * can offer a "tap to rejoin" affordance, WITHOUT the immediate lifecycle
   * watcher auto-joining on boot. Restore is always an explicit user tap.
   * Set on minimize; cleared on maximize / leave / entering a new room.
   */
  const minimizedRoom = ref<Room | null>(null);

  /**
   * Marker for the room the user is *actively* in, with the timestamp of its
   * last heartbeat. Only a marker whose heartbeat is within
   * ACTIVE_ROOM_MARKER_TTL_MS may authorise an automatic rehydrate — a stale
   * marker is ignored, so a cold link tap behaves exactly as it does today.
   */
  const activeRoom = ref<{ id: number; at: number } | null>(null);

  function setUserRoom(room: Room | null) {
    userRoom.value = room;
  }

  function setPreviousRoute(route: string) {
    previousRoute.value = route;
  }

  function setMinimizedRoom(room: Room | null) {
    minimizedRoom.value = room;
  }

  function setActiveRoom(roomId: number | null) {
    activeRoom.value = roomId === null ? null : { id: roomId, at: Date.now() };
  }

  return {
    userRoom,
    previousRoute,
    minimizedRoom,
    activeRoom,
    setUserRoom,
    setPreviousRoute,
    setMinimizedRoom,
    setActiveRoom,
  };
}, {
  // localStorage, seeded ONCE from the legacy `roomStore` cookie
  // (cost-and-speed-tuning 15, ADR 0048).
  //
  // `useRoomLifecycle`'s heartbeat calls `setActiveRoom` every
  // ACTIVE_ROOM_HEARTBEAT_MS, and every write used to go through
  // `piniaPluginPersistedstate.cookies()` → Nuxt `useCookie()`, leaking one
  // cookieStore listener per tick for the life of the page.
  //
  // 🔴 `activeRoom` is what `useRoomRehydration` reads to put a user back into
  // their Room after a WebView kill. The key keeps the legacy `roomStore` name,
  // and the first read with no localStorage value adopts the cookie the
  // previous build wrote (`encodeURIComponent(JSON)` — the decoded cookie IS the
  // serialized state), so a user mid-session on the OTA boot is still
  // rehydrated. After that first write the cookie is never read again; it is
  // left in place (session cookie) so an OTA rollback still finds it.
  persist: {
    key: ROOM_SESSION_STORAGE_KEY,
    pick: ['userRoom', 'previousRoute', 'minimizedRoom', 'activeRoom'],
    storage: seededLocalStorage(legacyCookieSeed(ROOM_SESSION_STORAGE_KEY)),
  },
});
