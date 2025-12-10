import type { SvgaPlayer, SvgaPlugin } from '@/types/svga'

export const useSvgaPlayer = (
    canvas: Ref<HTMLCanvasElement | null>,
    options: {
        name: Ref<string>;
        loop?: Ref<number>;
        autoplay?: Ref<boolean>;
    }
) => {
    if (!import.meta.client) return { player: null };

    const player = shallowRef<SvgaPlayer | null>(null);
    const nuxtApp = useNuxtApp();

    const load = async () => {
        if (!canvas.value) return;
        player.value?.destroy();
        player.value = await (nuxtApp.$svga as SvgaPlugin).createSvgaPlayer({
            canvas: canvas.value,
            name: options.name.value,
            loop: options.loop?.value,
            autoplay: options.autoplay?.value
        });
    };

    watch([options.name, options.loop ?? ref(), options.autoplay ?? ref()], load);
    onMounted(load);
    onBeforeUnmount(() => player.value?.destroy());

    return { player, reload: load };
};