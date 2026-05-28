/**
 * SVGA Player Types
 *
 * Type definitions for the SVGA player library (SVGAPlayer-Web-Lite)
 * https://github.com/svga/SVGAPlayer-Web-Lite
 */

// ========================================
// Video Entity (Parser output)
// ========================================

/**
 * Parsed SVGA video entity returned by Parser.load().
 * Contains decoded animation data, images, and metadata.
 */
export interface SvgaVideoEntity {
  /** Animation frame rate */
  readonly FPS: number
  /** Total number of frames */
  readonly frames: number
  /** Canvas width */
  readonly viewBoxWidth: number
  /** Canvas height */
  readonly viewBoxHeight: number
}

// ========================================
// Parser
// ========================================

/**
 * SVGA Parser — fetches .svga files, decompresses, decodes protobuf,
 * and creates ImageBitmaps in a WebWorker.
 */
export interface SvgaParser {
  /**
   * Load and parse an SVGA file from a URL.
   * Runs decompression and decoding in a WebWorker.
   */
  load(url: string): Promise<SvgaVideoEntity>

  /**
   * Cancel any in-progress loading operation.
   */
  cancel(): void

  /**
   * Destroy the parser and terminate its WebWorker.
   */
  destroy(): void
}

// ========================================
// Player
// ========================================

/**
 * SVGA Player instance returned by createSvgaPlayer
 */
export interface SvgaPlayer {
  /**
   * Mount parsed animation data to the player
   */
  mount(data: SvgaVideoEntity): Promise<void>

  /**
   * Start playing the animation
   */
  start(): void

  /**
   * Stop the animation
   */
  stop(): void

  /**
   * Pause the animation
   */
  pause(): void

  /**
   * Resume the animation
   */
  resume(): void

  /**
   * Destroy the player instance and clean up resources
   */
  destroy(): void

  /**
   * Current playback progress (0-1)
   */
  progress: number

  // ========================================
  // Event Callbacks (SVGAPlayer-Web-Lite API)
  // ========================================

  /** Called when playback starts */
  onStart?: () => void

  /** Called when playback resumes after pause */
  onResume?: () => void

  /** Called when playback is paused */
  onPause?: () => void

  /** Called when playback is stopped */
  onStop?: () => void

  /** Called on each frame during playback */
  onProcess?: () => void

  /** Called when playback completes (reaches the end) */
  onEnd?: () => void
}

// ========================================
// Plugin Interface
// ========================================

/**
 * Options for creating an SVGA player
 */
export interface CreateSvgaPlayerOptions {
  canvas: HTMLCanvasElement
  name: string
  loop?: number
  autoplay?: boolean
  replaceElements?: Record<string, HTMLImageElement>
  dynamicElements?: Record<string, HTMLCanvasElement>
}

/**
 * SVGA plugin interface provided by the svga-player plugin
 */
export interface SvgaPlugin {
  /**
   * Create a new SVGA player instance
   */
  createSvgaPlayer(options: CreateSvgaPlayerOptions): Promise<SvgaPlayer>

  /**
   * Parse and cache SVGA animation data (for preloading).
   * Uses the Parser's WebWorker for off-thread processing.
   */
  fetchAnimation(url: string): Promise<SvgaVideoEntity>

  /**
   * Check if an animation's VideoEntity is already cached
   */
  isCached(url: string): boolean
}

declare module '#app' {
  interface NuxtApp {
    $svga?: SvgaPlugin
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $svga: SvgaPlugin
  }
}

export {}
