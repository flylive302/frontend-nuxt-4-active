/**
 * SVGA Player Plugin
 *
 * Provides SVGA animation playback using SVGAPlayer-Web-Lite's built-in Parser.
 * The Parser fetches .svga binaries, decompresses (zlib), decodes (protobuf),
 * and creates ImageBitmaps — all in a WebWorker for off-thread performance.
 *
 * IMPORTANT: The Parser uses a single WebWorker internally. Calling parser.load()
 * concurrently overwrites the worker.onmessage handler, causing earlier loads to
 * hang forever. All loads are therefore serialized through a queue chain.
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
     * Serialization chain — ensures only one parser.load() runs at a time.
     * Each new load awaits the previous one before starting.
     */
    let loadChain: Promise<void> = Promise.resolve();

    /**
     * Parse and cache an SVGA animation from a URL.
     * Uses the Parser's WebWorker for off-thread decompression and decoding.
     * Loads are serialized to prevent concurrent WebWorker callback overwrites.
     *
     * @param url - URL to the .svga file
     */
    const fetchAnimation = (url: string): Promise<unknown> => {
        if (!cache.has(url)) {
            // Chain this load behind the previous one
            const loadPromise = loadChain.then(() => parser.load(url));

            // Extend the chain — next load waits for this one to finish
            // Use .catch() on the chain so a single failure doesn't block the queue
            loadChain = loadPromise.then(() => {}, () => {});

            cache.set(url, loadPromise);
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