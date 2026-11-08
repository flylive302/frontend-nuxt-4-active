/**
 * Room video source parser — pure, framework-agnostic.
 *
 * Turns whatever the controller pasted into a normalised `RoomVideoSource`, or
 * says precisely why it cannot be played. No Vue, store, socket or Nuxt imports.
 *
 * Accepted input:
 * - YouTube: `watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/` on
 *   `youtube.com` (also `www.`, `m.`, `music.`) and `youtube-nocookie.com`, or a
 *   bare 11-char id. Every shape yields the same `{ kind: 'youtube', videoId }`.
 *   Extra query params (`t`, `si`, `list`, ...) are ignored when a video id is
 *   present. A scheme-less paste (`youtu.be/ID`) is accepted for YouTube hosts only.
 * - Direct URL: `https:` only. The container comes from the path extension
 *   (`.mp4` -> mp4, `.m3u8` -> hls, case-insensitive; query and hash ignored), or
 *   from the caller's explicit `container`, which accepts any https URL.
 *
 * Documented decisions:
 * - `http://` YouTube links are accepted: only the 11-char id is kept, and the
 *   player always loads YouTube over https, so nothing insecure is ever fetched.
 *   `http://` links to anything else are `not_https`.
 * - A YouTube link always wins over an explicit `container` (a YouTube page is
 *   never a media file).
 * - A YouTube URL with no usable video id and no playlist / channel shape
 *   (`youtube.com/`, `watch` with a malformed id) is `not_media`.
 * - A bare 11-char string is taken as a YouTube id without any network check, so
 *   an 11-letter word also parses; the player simply fails to load it.
 */
import { ROOM_VIDEO_URL_MAX_LENGTH } from '~/constants/room';
import type {
  RoomVideoSource,
  VideoContainer,
  VideoSourceError,
  VideoSourceParseResult,
} from '~/types/room/video';

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** `/embed/videoseries?list=...` is a playlist embed whose "id" happens to be 11 chars. */
const YOUTUBE_PLAYLIST_EMBED_SEGMENT = 'videoseries';

/** Matches an explicit `scheme:` prefix (`https:`, `javascript:`, `data:`, ...). */
const SCHEME_PREFIX_PATTERN = /^[a-z][a-z0-9+.-]*:/i;

/** Hosts where the video id lives in the path / `v` param. */
const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

/** Short-link hosts where the video id is the first path segment. */
const YOUTUBE_SHORT_HOSTS: ReadonlySet<string> = new Set(['youtu.be', 'www.youtu.be']);

/** First path segments (`/shorts/ID`, `/embed/ID`, `/live/ID`) that carry the id as the next segment. */
const YOUTUBE_ID_PATH_PREFIXES: ReadonlySet<string> = new Set(['shorts', 'embed', 'live']);

/** First path segments (besides `@handle`) that mark a channel / user page. */
const YOUTUBE_CHANNEL_PATH_PREFIXES: ReadonlySet<string> = new Set(['channel', 'c', 'user']);

/** Lower-case path extension -> container. A Map, so `.constructor` cannot hit a prototype key. */
const EXTENSION_CONTAINERS: ReadonlyMap<string, VideoContainer> = new Map<string, VideoContainer>([
  ['mp4', 'mp4'],
  ['m3u8', 'hls'],
]);

function fail(error: VideoSourceError): VideoSourceParseResult {
  return { ok: false, error };
}

function succeed(source: RoomVideoSource): VideoSourceParseResult {
  return { ok: true, source };
}

function isYouTubeVideoId(candidate: string | null | undefined): candidate is string {
  return (
    candidate != null &&
    candidate !== YOUTUBE_PLAYLIST_EMBED_SEGMENT &&
    YOUTUBE_VIDEO_ID_PATTERN.test(candidate)
  );
}

function tryParseUrl(text: string): URL | null {
  try {
    return new URL(text);
  } catch {
    return null;
  }
}

/** The container implied by the URL **path** extension, ignoring query and hash. */
function containerFromPathname(pathname: string): VideoContainer | null {
  const lastSegment = pathname.split('/').pop() ?? '';
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex === -1) return null;
  return EXTENSION_CONTAINERS.get(lastSegment.slice(dotIndex + 1).toLowerCase()) ?? null;
}

/** Pull the video id out of an http(s) URL on a YouTube host, or `null` when there is none. */
function extractYouTubeVideoId(url: URL, segments: string[]): string | null {
  let candidate: string | null | undefined;
  if (YOUTUBE_SHORT_HOSTS.has(url.hostname)) {
    candidate = segments[0];
  } else if (segments[0] === 'watch') {
    candidate = url.searchParams.get('v');
  } else if (segments[0] !== undefined && YOUTUBE_ID_PATH_PREFIXES.has(segments[0])) {
    candidate = segments[1];
  }
  return isYouTubeVideoId(candidate) ? candidate : null;
}

/** `url` is http(s) on a known YouTube host. */
function parseYouTubeUrl(url: URL): VideoSourceParseResult {
  const segments = url.pathname.split('/').filter((segment) => segment !== '');

  const videoId = extractYouTubeVideoId(url, segments);
  if (videoId !== null) return succeed({ kind: 'youtube', videoId });

  // No video id: say *why*, so the UI can ask for a single video instead.
  const first = segments[0] ?? '';
  if (first.startsWith('@') || YOUTUBE_CHANNEL_PATH_PREFIXES.has(first)) {
    return fail('youtube_channel');
  }
  if (first === 'playlist' || url.searchParams.has('list')) {
    return fail('youtube_playlist');
  }
  return fail('not_media');
}

/**
 * Parse pasted text into a playable room video source.
 *
 * @param input     Raw text from the controller (trimmed here).
 * @param container Optional explicit container for a direct URL whose path has no
 *                  `.mp4` / `.m3u8` extension. Ignored for YouTube links.
 */
export function parseVideoSource(input: string, container?: VideoContainer): VideoSourceParseResult {
  const text = input.trim();
  if (text === '') return fail('empty');
  if (text.length > ROOM_VIDEO_URL_MAX_LENGTH) return fail('too_long');

  if (isYouTubeVideoId(text)) return succeed({ kind: 'youtube', videoId: text });

  const hasScheme = SCHEME_PREFIX_PATTERN.test(text);
  const url = tryParseUrl(hasScheme ? text : `https://${text}`);
  if (url === null) return fail('invalid_url');

  const isWebScheme = url.protocol === 'https:' || url.protocol === 'http:';
  const isYouTubeHost = YOUTUBE_HOSTS.has(url.hostname) || YOUTUBE_SHORT_HOSTS.has(url.hostname);
  if (isWebScheme && isYouTubeHost) return parseYouTubeUrl(url);

  // Scheme-less text is only understood for YouTube hosts; a direct URL needs its `https://`.
  if (!hasScheme) return fail('invalid_url');
  if (url.protocol === 'http:') return fail('not_https');
  if (url.protocol !== 'https:') return fail('unsupported_scheme');

  const resolvedContainer = container ?? containerFromPathname(url.pathname);
  if (resolvedContainer === null) return fail('not_media');

  // The URL constructor can percent-encode (e.g. spaces), so re-check the stored form.
  if (url.href.length > ROOM_VIDEO_URL_MAX_LENGTH) return fail('too_long');

  return succeed({ kind: 'url', url: url.href, container: resolvedContainer });
}
