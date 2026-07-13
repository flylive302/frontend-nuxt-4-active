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

        // The svga lib draws a base/dynamic element SCALED to its sprite layout
        // (`drawImage(el, 0, 0, layout.w, layout.h)`) but draws a replaceElement at
        // its NATURAL size, merely centered (`drawImage(img, (layout.w-img.width)/2,
        // …)`). So an oversized replacement (e.g. a 400px avatar in a 48px masked
        // slot) shows only a tiny center crop — it looks blank. Pre-render each
        // replacement into a canvas sized EXACTLY to its sprite layout so the
        // natural-size draw fills the slot like a base image. A replacement already
        // ~slot-sized (e.g. a gift thumbnail on a large slot) is unchanged.
        const sizeReplaceElementsToLayout = (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            videoEntity: any,
            replaceElements: Record<string, HTMLImageElement>
        ): Record<string, HTMLCanvasElement | HTMLImageElement> => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sprites: any[] = Array.isArray(videoEntity?.sprites) ? videoEntity.sprites : [];
            const out: Record<string, HTMLCanvasElement | HTMLImageElement> = {};

            for (const [key, img] of Object.entries(replaceElements)) {
                const sprite = sprites.find((s) => s?.imageKey === key);
                // Layout is per-frame but constant per sprite in practice (the
                // transform animates it) — use the first visible frame as target.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const frame = sprite?.frames?.find((f: any) => f?.alpha > 0.05 && f?.layout?.width > 0 && f?.layout?.height > 0);
                const w = Math.max(1, Math.round(frame?.layout?.width ?? 0));
                const h = Math.max(1, Math.round(frame?.layout?.height ?? 0));

                if (!frame || (img.width === w && img.height === h)) {
                    out[key] = img;
                    continue;
                }

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    out[key] = img;
                    continue;
                }
                ctx.drawImage(img, 0, 0, w, h);
                out[key] = canvas;
            }

            return out;
        };

        const createSvgaPlayer = async (options: {
            canvas: HTMLCanvasElement;
            name: string;
            loop?: number;
            autoplay?: boolean;
            // Named placeholders embedded in the .svga file by the designer.
            // replaceElements: swap a placeholder with an image (e.g. user avatar).
            // dynamicElements: inject a drawn canvas (e.g. username text).
            // Keys must match the placeholder names in the .svga file.
            replaceElements?: Record<string, HTMLImageElement>;
            dynamicElements?: Record<string, HTMLCanvasElement>;
        }) => {
            await ensureSvga();
            const player = new _PlayerCtor({
                container: options.canvas,
                loop: options.loop ?? 0
            });
            const videoEntity = await fetchAnimation(options.name);
            const sizedReplaceElements = options.replaceElements
                ? sizeReplaceElementsToLayout(videoEntity, options.replaceElements)
                : undefined;
            // Shallow-copy so the shared cache entry is never mutated.
            const entityToMount =
                options.replaceElements || options.dynamicElements
                    ? {
                          ...(videoEntity as object),
                          replaceElements: {
                              ...((videoEntity as Record<string, unknown>).replaceElements ?? {}),
                              ...sizedReplaceElements
                          },
                          dynamicElements: {
                              ...((videoEntity as Record<string, unknown>).dynamicElements ?? {}),
                              ...options.dynamicElements
                          }
                      }
                    : videoEntity;
            await player.mount(entityToMount);
            if (options.autoplay ?? true) player.start();
            return player;
        };

        return {
            provide: { svga: { createSvgaPlayer, fetchAnimation, isCached } }
        };
    }
});