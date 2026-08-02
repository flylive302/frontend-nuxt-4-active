// ========================================
// Sharing constants
// ========================================

/**
 * Public Play Store listing for the Android shell (`appId: com.flylive.app`).
 *
 * Shared room links deliberately point here rather than at a web URL: the SPA
 * has no public unauthenticated room route and Android App Links are not
 * configured (only the `com.flylive.app://` custom scheme exists), so an https
 * room URL could not open the installed app anyway.
 *
 * ⚠️ Kept in sync by hand with `runtimeConfig.playStoreUrl` in `nuxt.config.ts`
 * (used by the server-side `/go/android` redirect). Server runtime config is not
 * reachable from the SPA, so the value lives in both places — change both.
 */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.flylive.app';

/** Share-sheet title (used as the subject line when sharing to email). */
export const ROOM_SHARE_TITLE_TEMPLATE = 'Join {name} on FlyLive';

/**
 * Share-sheet body. Carries the room id because the link is a store link, not a
 * deep link — the numeric id is the only way the recipient can find this exact
 * room after installing.
 */
export const ROOM_SHARE_TEXT_TEMPLATE = 'Join "{name}" (Room #{id}) on FlyLive 🎙️';

/** Android-only share-dialog heading. */
export const ROOM_SHARE_DIALOG_TITLE = 'Share this room';
