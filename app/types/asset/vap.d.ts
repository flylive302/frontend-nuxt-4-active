/**
 * VAP (Video Animation Player) Types
 *
 * Type definitions for the VAP alpha-video player.
 * VAP plays MP4 videos with transparency by compositing RGB + alpha
 * regions via a WebGL shader.
 *
 * File convention: {name}.mp4 (video) + {name}.json (config)
 * @see https://github.com/Tencent/vap
 */

// ========================================
// VAP Config (JSON file)
// ========================================

/**
 * VAP JSON config shape (matches Tencent VAP v2 format).
 * Describes how to extract RGB and alpha data from the companion MP4.
 */
export interface VapConfig {
  info: {
    /** Format version (always 2) */
    v: number
    /** Total number of frames */
    f: number
    /** Display width (logical) */
    w: number
    /** Display height (logical) */
    h: number
    /** Frame rate */
    fps: number
    /** Source video width (actual MP4 width) */
    videoW: number
    /** Source video height (actual MP4 height) */
    videoH: number
    /** Alpha channel region in the video [x, y, width, height] */
    aFrame: [number, number, number, number]
    /** RGB color region in the video [x, y, width, height] */
    rgbFrame: [number, number, number, number]
    /** 0 = simple VAP, 1 = VAPx (dynamic elements — not supported) */
    isVapx: number
    /** Orientation (0 = normal) */
    orien: number
  }
}

// ========================================
// Player Instance
// ========================================

/**
 * VAP player instance returned by createVapPlayer.
 * Manages a hidden <video> element + WebGL canvas for alpha compositing.
 */
export interface VapPlayer {
  /** Start playing the animation */
  start(): void

  /** Stop the animation and reset to beginning */
  stop(): void

  /** Restart the animation from the beginning */
  restart(): void

  /** Destroy the player, release WebGL context and video element */
  destroy(): void

  // ========================================
  // Event Callbacks
  // ========================================

  /** Called when playback starts */
  onStart?: () => void

  /** Called when playback completes (all loops finished) */
  onEnd?: () => void

  /** Called when playback is stopped manually */
  onStop?: () => void
}

// ========================================
// Plugin Interface
// ========================================

/**
 * Options for creating a VAP player.
 */
export interface CreateVapPlayerOptions {
  /** Target canvas element for WebGL rendering */
  canvas: HTMLCanvasElement
  /** Base name/URL — resolves to {name}.mp4 + {name}.json */
  name: string
  /** Loop count (0 = infinite, 1 = play once). Default: 1 */
  loop?: number
  /** Whether to start immediately. Default: true */
  autoplay?: boolean
  /** Whether to mute audio. Default: true (required for autoplay on most browsers) */
  muted?: boolean
}

/**
 * VAP plugin interface provided by the vap-player plugin.
 */
export interface VapPlugin {
  /** Create a new VAP player instance */
  createVapPlayer(options: CreateVapPlayerOptions): Promise<VapPlayer>

  /** Preload and cache a VAP config JSON */
  preloadConfig(jsonUrl: string): Promise<VapConfig>

  /** Check if a config is already cached */
  isCached(jsonUrl: string): boolean
}

// ========================================
// Nuxt App Augmentation
// ========================================

declare module '#app' {
  interface NuxtApp {
    $vap?: VapPlugin
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $vap: VapPlugin
  }
}

export {}
