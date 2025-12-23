export default defineNuxtPlugin(async () => {
    const { Player } = await import((`svga/dist/index.esm.min.js`));

    const cache = new Map<string, Promise<unknown>>();
    
    /**
     * Fetch and cache SVGA animation data.
     * Exposed for preloading - uses the same cache as createSvgaPlayer.
     */
    const fetchAnimation = (name: string): Promise<unknown> => {
        if (!cache.has(name)) {
            cache.set(name, $fetch<unknown>(`/parsedAnimations/${name}.json`));
        }
        return cache.get(name)!;
    };

    /**
     * Check if an animation is already cached
     */
    const isCached = (name: string): boolean => {
        return cache.has(name);
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