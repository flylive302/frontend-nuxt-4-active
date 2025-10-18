export default defineNuxtPlugin(async () => {
    const { Player } = await import((`svga/dist/index.esm.min.js`));

    const cache = new Map<string, Promise<any>>();
    const fetchAnimation = (name: string) => {
        if (!cache.has(name)) {
            cache.set(name, $fetch(`/parsedAnimations/${name}.json`));
        }
        return cache.get(name)!;
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
        provide: { svga: { createSvgaPlayer } }
    };
});