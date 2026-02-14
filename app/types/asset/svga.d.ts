/**
 * SVGA Player Types
 *
 * Type definitions for the SVGA player library (SVGAPlayer-Web-Lite)
 * https://github.com/svga/SVGAPlayer-Web-Lite
 */

/**
 * SVGA Player instance returned by createSvgaPlayer
 */
export interface SvgaPlayer {
  /**
   * Mount animation data to the player
   */
  mount(data: unknown): Promise<void>;

  /**
   * Start playing the animation
   */
  start(): void;

  /**
   * Stop the animation
   */
  stop(): void;

  /**
   * Pause the animation
   */
  pause(): void;

  /**
   * Resume the animation
   */
  resume(): void;

  /**
   * Destroy the player instance and clean up resources
   */
  destroy(): void;

  /**
   * Current playback progress (0-1)
   */
  progress: number;

  // ========================================
  // Event Callbacks (SVGAPlayer-Web-Lite API)
  // ========================================

  /**
   * Called when playback starts
   */
  onStart?: () => void;

  /**
   * Called when playback resumes after pause
   */
  onResume?: () => void;

  /**
   * Called when playback is paused
   */
  onPause?: () => void;

  /**
   * Called when playback is stopped
   */
  onStop?: () => void;

  /**
   * Called on each frame during playback
   */
  onProcess?: () => void;

  /**
   * Called when playback completes (reaches the end)
   */
  onEnd?: () => void;
}

/**
 * Options for creating an SVGA player
 */
export interface CreateSvgaPlayerOptions {
  canvas: HTMLCanvasElement;
  name: string;
  loop?: number;
  autoplay?: boolean;
}

/**
 * SVGA plugin interface provided by the svga-player plugin
 */
export interface SvgaPlugin {
  /**
   * Create a new SVGA player instance
   */
  createSvgaPlayer(options: CreateSvgaPlayerOptions): Promise<SvgaPlayer>;

  /**
   * Fetch and cache SVGA animation data (for preloading)
   */
  fetchAnimation(name: string): Promise<unknown>;

  /**
   * Check if an animation is already cached
   */
  isCached(name: string): boolean;
}

declare module '#app' {
  interface NuxtApp {
    $svga?: SvgaPlugin;
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $svga: SvgaPlugin;
  }
}

export {};
