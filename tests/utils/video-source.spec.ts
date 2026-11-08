import { describe, expect, it } from 'vitest';
import { ROOM_VIDEO_URL_MAX_LENGTH } from '~/constants/room';
import { parseVideoSource } from '~/utils/video-source';

const ID = 'dQw4w9WgXcQ';

function youtube(videoId: string = ID) {
  return { ok: true, source: { kind: 'youtube', videoId } };
}

function urlSource(url: string, container: 'mp4' | 'hls') {
  return { ok: true, source: { kind: 'url', url, container } };
}

function failure(error: string) {
  return { ok: false, error };
}

describe('parseVideoSource: YouTube shapes', () => {
  it.each([
    ['watch', `https://www.youtube.com/watch?v=${ID}`],
    ['watch without www', `https://youtube.com/watch?v=${ID}`],
    ['mobile watch', `https://m.youtube.com/watch?v=${ID}`],
    ['music watch', `https://music.youtube.com/watch?v=${ID}`],
    ['short link', `https://youtu.be/${ID}`],
    ['shorts', `https://www.youtube.com/shorts/${ID}`],
    ['embed', `https://www.youtube.com/embed/${ID}`],
    ['live', `https://www.youtube.com/live/${ID}`],
    ['nocookie embed', `https://www.youtube-nocookie.com/embed/${ID}`],
    ['nocookie embed without www', `https://youtube-nocookie.com/embed/${ID}`],
    ['bare id', ID],
    ['bare id with surrounding whitespace', `  ${ID}\n`],
    ['scheme-less watch', `youtube.com/watch?v=${ID}`],
    ['scheme-less short link', `youtu.be/${ID}`],
    ['upper-case host', `HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`],
  ])('%s -> the same video id', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(youtube());
  });

  it.each([
    ['timestamp', `https://www.youtube.com/watch?v=${ID}&t=30s`],
    ['playlist alongside a video', `https://www.youtube.com/watch?v=${ID}&list=PLabc123&index=2`],
    ['share tracking param on a short link', `https://youtu.be/${ID}?si=abc123XYZ`],
    ['timestamp on a short link', `https://youtu.be/${ID}?t=42`],
    ['v param after other params', `https://www.youtube.com/watch?feature=share&v=${ID}`],
    ['query on shorts', `https://www.youtube.com/shorts/${ID}?feature=share`],
    ['hash fragment', `https://www.youtube.com/watch?v=${ID}#t=10`],
    ['trailing slash', `https://www.youtube.com/embed/${ID}/`],
  ])('ignores extra params: %s', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(youtube());
  });

  it('keeps the id case exactly (ids are case-sensitive)', () => {
    expect(parseVideoSource('https://youtu.be/AbCdEfGhIjK')).toEqual(youtube('AbCdEfGhIjK'));
  });

  it('accepts ids containing - and _', () => {
    expect(parseVideoSource('https://youtu.be/a-b_c-d_e-f')).toEqual(youtube('a-b_c-d_e-f'));
  });

  it('accepts http:// YouTube links (only the id is kept; the player loads over https)', () => {
    expect(parseVideoSource(`http://www.youtube.com/watch?v=${ID}`)).toEqual(youtube());
    expect(parseVideoSource(`http://youtu.be/${ID}`)).toEqual(youtube());
  });

  it('lets a YouTube link win over an explicit container', () => {
    expect(parseVideoSource(`https://youtu.be/${ID}`, 'mp4')).toEqual(youtube());
  });
});

describe('parseVideoSource: YouTube refusals', () => {
  it.each([
    ['playlist page', 'https://www.youtube.com/playlist?list=PLabc123def456'],
    ['watch with only a list', 'https://www.youtube.com/watch?list=PLabc123def456'],
    ['mobile playlist page', 'https://m.youtube.com/playlist?list=PLabc123def456'],
    ['playlist embed', 'https://www.youtube.com/embed/videoseries?list=PLabc123def456'],
    ['short link carrying only a list', 'https://youtu.be/?list=PLabc123def456'],
  ])('%s -> youtube_playlist', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(failure('youtube_playlist'));
  });

  it.each([
    ['channel id', 'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw'],
    ['@handle', 'https://www.youtube.com/@RickAstleyYT'],
    ['@handle videos tab', 'https://www.youtube.com/@RickAstleyYT/videos'],
    ['/c/ custom url', 'https://www.youtube.com/c/RickAstleyYT'],
    ['/user/ legacy url', 'https://www.youtube.com/user/RickAstleyVEVO'],
    ['mobile @handle', 'https://m.youtube.com/@RickAstleyYT'],
  ])('%s -> youtube_channel', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(failure('youtube_channel'));
  });

  it.each([
    ['home page', 'https://www.youtube.com/'],
    ['watch without v', 'https://www.youtube.com/watch'],
    ['watch with a malformed id', 'https://www.youtube.com/watch?v=tooShort'],
    ['short link with a malformed id', 'https://youtu.be/nope'],
    ['short link with no id', 'https://youtu.be/'],
    ['feed page', 'https://www.youtube.com/feed/subscriptions'],
    ['embed with no id', 'https://www.youtube.com/embed/'],
  ])('%s -> not_media', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(failure('not_media'));
  });

  it('does not treat a look-alike host as YouTube', () => {
    expect(parseVideoSource(`https://youtube.com.evil.example/watch?v=${ID}`)).toEqual(
      failure('not_media'),
    );
    expect(parseVideoSource(`https://youtube.com@evil.example/watch?v=${ID}`)).toEqual(
      failure('not_media'),
    );
  });
});

describe('parseVideoSource: direct URLs', () => {
  it('accepts an https .mp4', () => {
    expect(parseVideoSource('https://cdn.example.com/clips/movie.mp4')).toEqual(
      urlSource('https://cdn.example.com/clips/movie.mp4', 'mp4'),
    );
  });

  it('accepts an https .m3u8 as hls', () => {
    expect(parseVideoSource('https://cdn.example.com/live/index.m3u8')).toEqual(
      urlSource('https://cdn.example.com/live/index.m3u8', 'hls'),
    );
  });

  it('reads the extension from the path, ignoring query and hash', () => {
    expect(parseVideoSource('https://cdn.example.com/movie.mp4?token=abc&e=1')).toEqual(
      urlSource('https://cdn.example.com/movie.mp4?token=abc&e=1', 'mp4'),
    );
    expect(parseVideoSource('https://cdn.example.com/index.m3u8#start')).toEqual(
      urlSource('https://cdn.example.com/index.m3u8#start', 'hls'),
    );
  });

  it('is case-insensitive about the extension', () => {
    expect(parseVideoSource('https://cdn.example.com/MOVIE.MP4')).toEqual(
      urlSource('https://cdn.example.com/MOVIE.MP4', 'mp4'),
    );
    expect(parseVideoSource('https://cdn.example.com/Index.M3U8')).toEqual(
      urlSource('https://cdn.example.com/Index.M3U8', 'hls'),
    );
  });

  it('trims surrounding whitespace', () => {
    expect(parseVideoSource('  https://cdn.example.com/movie.mp4 \n')).toEqual(
      urlSource('https://cdn.example.com/movie.mp4', 'mp4'),
    );
  });

  it('does not take the extension from the query string', () => {
    expect(parseVideoSource('https://cdn.example.com/watch?file=movie.mp4')).toEqual(
      failure('not_media'),
    );
  });

  it('does not take the extension from the hostname', () => {
    expect(parseVideoSource('https://movie.mp4')).toEqual(failure('not_media'));
  });

  it('rejects an https URL with a non-media extension', () => {
    expect(parseVideoSource('https://example.com/page.html')).toEqual(failure('not_media'));
  });

  it('rejects an https URL with no extension', () => {
    expect(parseVideoSource('https://example.com/video/12345')).toEqual(failure('not_media'));
    expect(parseVideoSource('https://example.com')).toEqual(failure('not_media'));
  });

  it('rejects a media extension that is only a prefix of the real one', () => {
    expect(parseVideoSource('https://example.com/movie.mp4x')).toEqual(failure('not_media'));
    expect(parseVideoSource('https://example.com/movie.constructor')).toEqual(failure('not_media'));
  });

  it('accepts any https URL when the container is given explicitly', () => {
    expect(parseVideoSource('https://example.com/stream/12345', 'hls')).toEqual(
      urlSource('https://example.com/stream/12345', 'hls'),
    );
    expect(parseVideoSource('https://example.com/page.html', 'mp4')).toEqual(
      urlSource('https://example.com/page.html', 'mp4'),
    );
  });

  it('lets an explicit container override the extension', () => {
    expect(parseVideoSource('https://example.com/movie.mp4', 'hls')).toEqual(
      urlSource('https://example.com/movie.mp4', 'hls'),
    );
  });
});

describe('parseVideoSource: scheme and syntax refusals', () => {
  it('rejects http:// with not_https', () => {
    expect(parseVideoSource('http://cdn.example.com/movie.mp4')).toEqual(failure('not_https'));
  });

  it('rejects http:// even when the container is explicit', () => {
    expect(parseVideoSource('http://cdn.example.com/stream', 'hls')).toEqual(failure('not_https'));
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['JavaScript: in mixed case', 'JavaScript:alert(1)'],
    ['data:', 'data:video/mp4;base64,AAAA'],
    ['blob:', 'blob:https://example.com/3f1d6c8e-0000-0000-0000-000000000000'],
    ['file:', 'file:///home/user/movie.mp4'],
    ['ftp:', 'ftp://example.com/movie.mp4'],
    ['wss:', 'wss://example.com/movie.mp4'],
    ['javascript: dressed as a YouTube host', `javascript://youtube.com/%0Aalert(1)//watch?v=${ID}`],
  ])('rejects %s with unsupported_scheme', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(failure('unsupported_scheme'));
    expect(parseVideoSource(input, 'mp4')).toEqual(failure('unsupported_scheme'));
  });

  it.each([
    ['plain words', 'not a url at all'],
    ['a bare word', 'hello'],
    ['a scheme-less non-YouTube host', 'example.com/movie.mp4'],
    ['a protocol-relative URL', '//example.com/movie.mp4'],
    ['a malformed host', 'https://exa mple.com/movie.mp4'],
    ['no host', 'https://'],
  ])('rejects %s with invalid_url', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(failure('invalid_url'));
  });
});

describe('parseVideoSource: length and emptiness', () => {
  it.each([
    ['empty', ''],
    ['spaces', '   '],
    ['whitespace characters', ' \t\n '],
  ])('rejects %s input with empty', (_label, input) => {
    expect(parseVideoSource(input)).toEqual(failure('empty'));
  });

  it('accepts a URL of exactly the maximum length', () => {
    const prefix = 'https://cdn.example.com/';
    const suffix = '.mp4';
    const url = `${prefix}${'a'.repeat(ROOM_VIDEO_URL_MAX_LENGTH - prefix.length - suffix.length)}${suffix}`;
    expect(url).toHaveLength(ROOM_VIDEO_URL_MAX_LENGTH);

    expect(parseVideoSource(url)).toEqual(urlSource(url, 'mp4'));
  });

  it('rejects a URL one character over the maximum with too_long', () => {
    const prefix = 'https://cdn.example.com/';
    const suffix = '.mp4';
    const url = `${prefix}${'a'.repeat(ROOM_VIDEO_URL_MAX_LENGTH - prefix.length - suffix.length + 1)}${suffix}`;
    expect(url).toHaveLength(ROOM_VIDEO_URL_MAX_LENGTH + 1);

    expect(parseVideoSource(url)).toEqual(failure('too_long'));
  });

  it('rejects an over-long YouTube link too', () => {
    const url = `https://www.youtube.com/watch?v=${ID}&junk=${'x'.repeat(ROOM_VIDEO_URL_MAX_LENGTH)}`;
    expect(parseVideoSource(url)).toEqual(failure('too_long'));
  });

  it('counts the length after trimming, not before', () => {
    const prefix = 'https://cdn.example.com/';
    const suffix = '.mp4';
    const url = `${prefix}${'a'.repeat(ROOM_VIDEO_URL_MAX_LENGTH - prefix.length - suffix.length)}${suffix}`;

    expect(parseVideoSource(`   ${url}   `)).toEqual(urlSource(url, 'mp4'));
  });

  it('rejects a URL that only exceeds the maximum once percent-encoded', () => {
    const prefix = 'https://cdn.example.com/';
    const suffix = '.mp4';
    // Each space becomes %20 (3 chars), so the stored URL outgrows the limit.
    const url = `${prefix}${' '.repeat(ROOM_VIDEO_URL_MAX_LENGTH - prefix.length - suffix.length)}${suffix}`;
    expect(url.trim()).toHaveLength(ROOM_VIDEO_URL_MAX_LENGTH);

    expect(parseVideoSource(url)).toEqual(failure('too_long'));
  });
});
