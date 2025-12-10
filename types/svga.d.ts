/**
 * SVGA Player instance returned by createSvgaPlayer
 */
export interface SvgaPlayer {
    /**
     * Mount animation data to the player
     */
    mount(data: any): Promise<void>
    
    /**
     * Start playing the animation
     */
    start(): void
    
    /**
     * Destroy the player instance and clean up resources
     */
    destroy(): void
}

/**
 * Options for creating an SVGA player
 */
export interface CreateSvgaPlayerOptions {
    canvas: HTMLCanvasElement
    name: string
    loop?: number
    autoplay?: boolean
}

/**
 * SVGA plugin interface provided by the svga-player plugin
 */
export interface SvgaPlugin {
    /**
     * Create a new SVGA player instance
     */
    createSvgaPlayer(options: CreateSvgaPlayerOptions): Promise<SvgaPlayer>
}

declare module '#app' {
    interface NuxtApp {
        $svga: SvgaPlugin
    }
}

declare module 'vue' {
    interface ComponentCustomProperties {
        $svga: SvgaPlugin
    }
}

export {}

