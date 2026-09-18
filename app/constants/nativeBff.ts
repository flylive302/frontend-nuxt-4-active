/**
 * Native BFF Constants
 *
 * Route suffixes and the third-party endpoint `~/utils/native-bff` uses to
 * repoint same-origin Nitro BFF routes when running inside the Capacitor
 * native shell (no Nitro server there). See that file for the full mechanism.
 */

/** `${apiBase}` + this = the native replacement for the `/api/rooms` BFF route. */
export const NATIVE_BFF_ROOMS_PATH = '/rooms';

/** `${apiBase}` + this = the native replacement for the `/api/banners` BFF route. */
export const NATIVE_BFF_BANNERS_PATH = '/event-banners';

/**
 * Third-party IP-geolocation endpoint called directly on native, in place of
 * the `/api/detect-country` BFF route (which has no Nitro server to answer it
 * there).
 */
export const NATIVE_GEOJS_COUNTRY_URL = 'https://get.geojs.io/v1/ip/country.json';

/** Timeout for the native geojs.io country-detection call, in milliseconds. */
export const NATIVE_GEOJS_TIMEOUT_MS = 3000;
