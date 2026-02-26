/**
 * SVGA Player Plugin
 *
 * Provides SVGA animation playback using SVGAPlayer-Web-Lite's built-in Parser.
 * The Parser fetches .svga binaries, decompresses (zlib), decodes (protobuf),
 * and creates ImageBitmaps — all in a WebWorker for off-thread performance.
 *
 * @see https://github.com/svga/SVGAPlayer-Web-Lite
 */
export default defineNuxtPlugin(async () => {
    const { Player, Parser } = await import((`svga/dist/index.esm.min.js`));

    // Single shared parser — reuses its internal WebWorker across all loads
    const parser = new Parser();

    // Cache parsed VideoEntity objects for instant replay
    const cache = new Map<string, Promise<unknown>>();

    /**
     * Parse and cache an SVGA animation from a URL.
     * Uses the Parser's WebWorker for off-thread decompression and decoding.
     * Exposed for preloading — uses the same cache as createSvgaPlayer.
     *
     * @param url - Full URL to the .svga file on CDN
     */
    const fetchAnimation = (url: string): Promise<unknown> => {
        if (!cache.has(url)) {
            cache.set(url, parser.load(url));
        }
        return cache.get(url)!;
    };

    /**
     * Check if an animation's VideoEntity is already cached.
     */
    const isCached = (url: string): boolean => {
        return cache.has(url);
    };

    /**
     * Create a new SVGA player instance, load animation, and optionally autoplay.
     *
     * @param options.canvas - Target canvas element for rendering
     * @param options.name - Full URL to the .svga file
     * @param options.loop - Loop count (0 = infinite)
     * @param options.autoplay - Whether to start immediately
     */
    const createSvgaPlayer = async (options: {
        canvas: HTMLCanvasElement;
        name: string;
        loop?: number;
        autoplay?: boolean;
    }) => {
        const player = new Player({
            container: options.canvas,
            loop: options.loop ?? 0
        });
        const videoEntity = await fetchAnimation(options.name);
        await player.mount(videoEntity);
        if (options.autoplay ?? true) player.start();
        return player;
    };

    return {
        provide: { svga: { createSvgaPlayer, fetchAnimation, isCached } }
    };
});