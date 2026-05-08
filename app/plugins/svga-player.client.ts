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
export default defineNuxtPlugin({
    name: 'svga-player',
    // Don't block app init on the svga library or its WebWorker. Auth/login
    // pages never play SVGA animations — defer the import + Parser construction
    // until the first consumer actually calls createSvgaPlayer/fetchAnimation.
    parallel: true,
    setup() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let _PlayerCtor: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let _parser: any = null;
        let _initPromise: Promise<void> | null = null;

        const ensureSvga = (): Promise<void> => {
            if (_initPromise) return _initPromise;
            _initPromise = (async () => {
                const mod = await import('svga/dist/index.esm.min.js');
                _PlayerCtor = mod.Player;
                _parser = new mod.Parser();
            })();
            return _initPromise;
        };

        const cache = new Map<string, Promise<unknown>>();
        let loadChain: Promise<void> = Promise.resolve();

        const fetchAnimation = (url: string): Promise<unknown> => {
            if (!cache.has(url)) {
                const loadPromise = loadChain.then(async () => {
                    await ensureSvga();
                    return _parser.load(url);
                });
                loadChain = loadPromise.then(() => {}, () => {});
                cache.set(url, loadPromise);
            }
            return cache.get(url)!;
        };

        const isCached = (url: string): boolean => cache.has(url);

        const createSvgaPlayer = async (options: {
            canvas: HTMLCanvasElement;
            name: string;
            loop?: number;
            autoplay?: boolean;
        }) => {
            await ensureSvga();
            const player = new _PlayerCtor({
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
    }
});