import type {App} from "vue";

export const useSvgaPlayer = (
    canvas: Ref<HTMLCanvasElement | null>,
    options: {
        name: Ref<string>;
        loop?: Ref<number>;
        autoplay?: Ref<boolean>;
    }
) => {
    if (!import.meta.client) return { player: null };

    const player = shallowRef<
        Awaited<ReturnType<App['$svga']['createSvgaPlayer']>> | null
    >(null);
    const nuxtApp = useNuxtApp();

    const load = async () => {
        if (!canvas.value) return;
        player.value?.destroy();
        player.value = await nuxtApp.$svga.createSvgaPlayer({
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