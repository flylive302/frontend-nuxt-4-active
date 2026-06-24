// ========================================
// Room Minimize Interceptor (global)
// ========================================
//
// NavigationInterceptor for the room session lifecycle.
//
// Any navigation AWAY from the full-screen room route (device hardware back,
// in-app links, swipe-back) must MINIMIZE the room — never silently abandon it
// with a live mic. The room connection itself is app-level (useRoomLifecycle in
// global-shell) and already survives route changes; this guard only flips the
// `isMinimized` flag so the mini-player appears and the user can get back / mute.
//
// Decision rule (minimize vs leave):
//   Every explicit Leave path (header Leave, mini-player ✕, room:closed,
//   room:kicked) clears `currentRoom` via roomStore.leaveRoom() BEFORE it
//   navigates. So if we're leaving the room route while `currentRoom` is still
//   set, it was NOT an explicit leave → minimize. `minimizeRoom()` is itself a
//   no-op when `currentRoom` is null, so a leave can never be misread as a
//   minimize even if ordering ever changes.
export default defineNuxtRouteMiddleware((to, from) => {
  // Router guards run on the server too; the room session is client-only.
  if (import.meta.server) return;

  const leavingRoomRoute = from.path.startsWith('/room/') && !to.path.startsWith('/room/');
  if (!leavingRoomRoute) return;

  // Don't minimize on logout / block navigations (e.g. auth:force_disconnect
  // logs out then routes to /blocked while currentRoom is still set) — that
  // would persist a stale "tap to rejoin" snapshot for a signed-out user.
  if (!useAuthStore().isAuthenticated) return;

  const roomStore = useRoomStore();
  if (roomStore.currentRoom && !roomStore.isMinimized) {
    roomStore.minimizeRoom();
  }
});
