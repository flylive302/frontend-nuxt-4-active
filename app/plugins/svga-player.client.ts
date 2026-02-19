export default defineNuxtPlugin(async () => {
    const { Player } = await import((`svga/dist/index.esm.min.js`));

    const cache = new Map<string, Promise<unknown>>();
    
    /**
     * Fetch and cache SVGA animation data.
     * Exposed for preloading - uses the same cache as createSvgaPlayer.
     * Expects a full URL to the SVGA JSON file.
     */
    const fetchAnimation = (url: string): Promise<unknown> => {
        if (!cache.has(url)) {
            cache.set(url, $fetch<unknown>(url));
        }
        return cache.get(url)!;
    };

    /**
     * Check if an animation is already cached
     */
    const isCached = (url: string): boolean => {
        return cache.has(url);
    };

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
        const data = await fetchAnimation(options.name);
        await player.mount(data);
        if (options.autoplay ?? true) player.start();
        return player;
    };

    return {
        provide: { svga: { createSvgaPlayer, fetchAnimation, isCached } }
    };
});