/**
 * VAP (Video Animation Player) Plugin
 *
 * Provides alpha-video playback using a WebGL shader that composites
 * RGB and alpha regions from a single MP4 video onto a transparent canvas.
 *
 * How it works:
 * 1. Fetches the {name}.json config to learn where RGB and alpha regions are
 * 2. Loads {name}.mp4 into a hidden <video> element (hardware decoded)
 * 3. On each frame, a WebGL shader samples RGB from one region and alpha
 *    from another, outputting a transparent animation on the visible canvas
 *
 * Falls back to a 2D canvas software renderer when WebGL is unavailable.
 *
 * Zero npm dependencies — uses native <video> + WebGL/Canvas2D APIs.
 *
 * @see https://github.com/Tencent/vap
 */
import type { VapConfig, VapPlayer } from '~/types/asset/vap'
import * as giftAssetCache from '~/services/giftAssetCache'
import { createLogger } from '~/utils/logger'

const log = createLogger('[VAP]')

// ========================================
// WebGL Shaders
// ========================================

const VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_texCoord = a_texCoord;
  }
`

/**
 * Fragment shader that composites RGB + alpha from different video regions.
 * u_rgbRect and u_aRect are normalized [x, y, w, h] regions within the video texture.
 * The alpha region's red channel is used as the alpha value.
 */
const FRAGMENT_SHADER = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_video;
  uniform vec4 u_rgbRect;
  uniform vec4 u_aRect;
  void main() {
    // Map v_texCoord (0..1) to the RGB region of the video
    vec2 rgbCoord = u_rgbRect.xy + v_texCoord * u_rgbRect.zw;
    // Map v_texCoord (0..1) to the alpha region of the video
    vec2 aCoord = u_aRect.xy + v_texCoord * u_aRect.zw;
    vec4 rgbColor = texture2D(u_video, rgbCoord);
    float rawAlpha = texture2D(u_video, aCoord).r;
    // H.264 block compression produces artifacts in "transparent" areas.
    // smoothstep(0.3, 0.7): below 30% → fully transparent, above 70% → opaque.
    // VAP alpha masks use R≈255 for visible content, so this only affects noise.
    float alpha = smoothstep(0.3, 0.7, rawAlpha);
    gl_FragColor = vec4(rgbColor.rgb, alpha);
  }
`

// ========================================
// WebGL Helpers
// ========================================

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`[VAP] Shader compile error: ${info}`)
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`[VAP] Program link error: ${info}`)
  }
  // Clean up individual shaders after linking
  gl.deleteShader(vs)
  gl.deleteShader(fs)
  return program
}

function setupGeometry(gl: WebGLRenderingContext, program: WebGLProgram): void {
  // Full-screen quad: 2 triangles covering the entire canvas
  const positions = new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ])
  // Texture coordinates (flipped Y for video)
  const texCoords = new Float32Array([
    0, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 0,
  ])

  const posBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const texBuf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf)
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW)
  const aTex = gl.getAttribLocation(program, 'a_texCoord')
  gl.enableVertexAttribArray(aTex)
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0)
}

/**
 * Try to acquire a WebGL context with fallback chain.
 * Returns null if no WebGL context is available.
 */
function tryGetWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  const glOptions = {
    alpha: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  }

  // Try each WebGL variant on the actual canvas
  for (const name of ['webgl', 'webgl2', 'experimental-webgl'] as const) {
    try {
      const ctx = canvas.getContext(name, glOptions) as WebGLRenderingContext | null
      if (!ctx) continue

      // Detect zombie/lost contexts: a lost context returns null for RENDERER.
      // This happens when a previous loseContext() was called on this canvas,
      // or the GPU process crashed. The context object is non-null but useless.
      const renderer = ctx.getParameter(ctx.RENDERER)
      if (!renderer) {
        return null
      }

      return ctx
    }
    catch (err) {
      log.warn('Failed to get WebGL context', err)
    }
  }

  return null
}

// ========================================
// Renderer Interfaces
// ========================================

interface Renderer {
  /** Draw a single frame from the video onto the canvas */
  drawFrame(video: HTMLVideoElement): void
  /** Clear the canvas to transparent */
  clear(): void
  /** Release GPU/canvas resources */
  destroy(): void
}

/**
 * WebGL-based renderer (GPU accelerated, best performance).
 */
function createWebGLRenderer(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext,
  info: VapConfig['info'],
): Renderer {
  const program = createProgram(gl)
  gl.useProgram(program)
  setupGeometry(gl, program)

  // NOTE: Blending is intentionally DISABLED.
  // We draw a single quad on a cleared transparent canvas — no compositing needed.
  // The fragment shader outputs straight RGBA directly to the framebuffer.
  // Previously, gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA) produced
  // premultiplied RGB (rgb*alpha) but canvas was premultipliedAlpha:false,
  // causing the browser to divide rgb/alpha → artifacts near zero-alpha = black backdrop.

  // Create video texture
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  // Set uniform locations
  const uRgbRect = gl.getUniformLocation(program, 'u_rgbRect')
  const uARect = gl.getUniformLocation(program, 'u_aRect')

  // Normalize frame regions to 0..1 UV space
  const rgbRect = [
    info.rgbFrame[0] / info.videoW,
    info.rgbFrame[1] / info.videoH,
    info.rgbFrame[2] / info.videoW,
    info.rgbFrame[3] / info.videoH,
  ]
  const aRect = [
    info.aFrame[0] / info.videoW,
    info.aFrame[1] / info.videoH,
    info.aFrame[2] / info.videoW,
    info.aFrame[3] / info.videoH,
  ]

  gl.uniform4f(uRgbRect, rgbRect[0]!, rgbRect[1]!, rgbRect[2]!, rgbRect[3]!)
  gl.uniform4f(uARect, aRect[0]!, aRect[1]!, aRect[2]!, aRect[3]!)

  return {
    drawFrame(video: HTMLVideoElement) {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    },
    clear() {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
    destroy() {
      gl.deleteTexture(texture)
      gl.deleteProgram(program)
      // NOTE: Do NOT call loseContext() here.
      // It permanently taints the canvas — any subsequent getContext('webgl')
      // on the same canvas returns a zombie context (renderer: null).
      // Resource cleanup via delete* is sufficient; the GC handles the rest.
    },
  }
}

/**
 * 2D Canvas software renderer (fallback when WebGL is unavailable).
 * Uses canvas compositing operations (destination-in) to apply the alpha mask.
 * The alpha region's RED channel is converted to actual ALPHA before compositing.
 */
function createCanvas2DRenderer(
  canvas: HTMLCanvasElement,
  info: VapConfig['info'],
): Renderer {
  const ctx = canvas.getContext('2d')!

  // Offscreen canvas sized to the video frame for reading regions
  const offscreen = document.createElement('canvas')
  offscreen.width = info.videoW
  offscreen.height = info.videoH
  const offCtx = offscreen.getContext('2d')!

  // Alpha mask canvas — red channel gets converted to actual alpha
  const alphaCanvas = document.createElement('canvas')
  alphaCanvas.width = info.w
  alphaCanvas.height = info.h
  const alphaCtx = alphaCanvas.getContext('2d', { willReadFrequently: true })!

  // Pre-compute region coordinates (pixel space within the video)
  const [rgbX, rgbY, rgbW, rgbH] = info.rgbFrame
  const [aX, aY, aW, aH] = info.aFrame

  return {
    drawFrame(video: HTMLVideoElement) {
      // Step 1: Draw the full video frame to offscreen canvas
      offCtx.drawImage(video, 0, 0, info.videoW, info.videoH)

      // Step 2: Draw the RGB region onto the main canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(
        offscreen,
        rgbX, rgbY, rgbW, rgbH,
        0, 0, info.w, info.h,
      )

      // Step 3: Draw the alpha region to the alpha canvas
      alphaCtx.clearRect(0, 0, info.w, info.h)
      alphaCtx.drawImage(
        offscreen,
        aX, aY, aW, aH,
        0, 0, info.w, info.h,
      )

      // Step 4: Convert the RED channel → ALPHA channel.
      // VAP stores transparency in the red channel of the alpha region,
      // but canvas compositing uses the actual alpha channel.
      const maskData = alphaCtx.getImageData(0, 0, info.w, info.h)
      const px = maskData.data
      for (let i = 0; i < px.length; i += 4) {
        // Red channel becomes alpha; threshold kills H.264 compression artifacts
        const rawAlpha = px[i]! // red channel = opacity
        // H.264 artifacts can reach ~64/255 in transparent areas.
        // Threshold at 76 (≈0.3) matches the WebGL shader's lower bound.
        const alpha = rawAlpha < 76 ? 0 : Math.min(255, Math.round((rawAlpha - 76) / (179 - 76) * 255))
        px[i] = 255      // R
        px[i + 1] = 255  // G
        px[i + 2] = 255  // B
        px[i + 3] = alpha // A ← from red channel (thresholded)
      }
      alphaCtx.putImageData(maskData, 0, 0)

      // Step 5: Apply the alpha mask using 'destination-in' compositing.
      // This keeps RGB pixels from step 2 only where mask alpha > 0.
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(alphaCanvas, 0, 0)

      // Reset composite mode
      ctx.globalCompositeOperation = 'source-over'
    },
    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    },
    destroy() {
      offscreen.width = 0
      offscreen.height = 0
      alphaCanvas.width = 0
      alphaCanvas.height = 0
    },
  }
}

// ========================================
// Plugin
// ========================================

export default defineNuxtPlugin({ name: 'vap-player', parallel: true, setup() {
  // Cache for parsed VAP JSON configs
  const configCache = new Map<string, Promise<VapConfig>>()

  /**
   * Fetch and cache a VAP config JSON.
   */
  const preloadConfig = (jsonUrl: string): Promise<VapConfig> => {
    if (!configCache.has(jsonUrl)) {
      const promise = fetch(jsonUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`[VAP] Config fetch failed: ${res.status} ${jsonUrl}`)
          return res.json() as Promise<VapConfig>
        })
      configCache.set(jsonUrl, promise)
    }
    return configCache.get(jsonUrl)!
  }

  /**
   * Check if a config is already cached.
   */
  const isCached = (jsonUrl: string): boolean => {
    return configCache.has(jsonUrl)
  }

  /**
   * Create a new VAP player instance.
   *
   * @param options.canvas - Target canvas element for rendering
   * @param options.name - Video URL — can include .mp4 extension (e.g. /vip/3/card.mp4). The .json config is derived automatically.
   * @param options.loop - Loop count (0 = infinite, 1 = play once)
   * @param options.autoplay - Whether to start immediately
   * @param options.muted - Mute audio (default: true, required for autoplay)
   */
  const createVapPlayer = async (options: {
    canvas: HTMLCanvasElement
    name: string
    loop?: number
    autoplay?: boolean
    muted?: boolean
  }): Promise<VapPlayer> => {
    // Derive base name: strip .mp4 extension if present, so we can build both paths
    const baseName = options.name.endsWith('.mp4')
      ? options.name.slice(0, -4)
      : options.name
    const jsonUrl = `${baseName}.json`
    const videoUrl = `${baseName}.mp4`
    const loopCount = options.loop ?? 1
    const isMuted = options.muted ?? true


    // EXECUTE: Fetch config
    const config = await preloadConfig(jsonUrl)
    const { info } = config

    // EXECUTE: Set canvas dimensions to logical display size
    options.canvas.width = info.w
    options.canvas.height = info.h

    // EXECUTE: Initialize renderer (WebGL with 2D canvas fallback)
    let renderer: Renderer

    const gl = tryGetWebGLContext(options.canvas)
    if (gl) {
      try {
        renderer = createWebGLRenderer(options.canvas, gl, info)
      }
      catch (webglErr) {
        log.warn('WebGL renderer failed, falling back to Canvas2D', webglErr)
        renderer = createCanvas2DRenderer(options.canvas, info)
      }
    }
    else {
      renderer = createCanvas2DRenderer(options.canvas, info)
    }

    // EXECUTE: Create hidden video element
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.muted = isMuted
    video.preload = 'auto'
    video.style.display = 'none'
    document.body.appendChild(video)

    // State
    let frameHandle: number | null = null
    let usingRVFC = false
    let currentLoop = 0
    let destroyed = false

    // requestVideoFrameCallback accessor — typed defensively because it is
    // absent from some TS DOM libs and older WebView engines.
    const rvfc = video as unknown as {
      requestVideoFrameCallback?: (cb: () => void) => number
      cancelVideoFrameCallback?: (handle: number) => void
    }
    const supportsRVFC = typeof rvfc.requestVideoFrameCallback === 'function'

    // Player instance
    const player: VapPlayer = {
      onStart: undefined,
      onEnd: undefined,
      onStop: undefined,

      start() {
        if (destroyed) return
        currentLoop = 0
        video.currentTime = 0

        video.play().then(() => {
          player.onStart?.()
          scheduleFrame()
        }).catch((err) => {
          log.warn('Autoplay blocked, attempting muted fallback', err)
          if (!video.muted) {
            video.muted = true
            video.play().then(() => {
              player.onStart?.()
              scheduleFrame()
            }).catch((err2) => {
              log.warn('Muted autoplay fallback also failed', err2)
            })
          }
        })
      },

      stop() {
        if (destroyed) return
        cancelRender()
        video.pause()
        video.currentTime = 0
        renderer.clear()
        player.onStop?.()
      },

      restart() {
        if (destroyed) return
        cancelRender()
        currentLoop = 0
        video.currentTime = 0
        video.play().then(() => {
          player.onStart?.()
          scheduleFrame()
        }).catch((err) => {
          log.warn('Restart autoplay blocked, attempting muted fallback', err)
          if (!video.muted) {
            video.muted = true
            video.play().then(() => {
              player.onStart?.()
              scheduleFrame()
            }).catch(() => {})
          }
        })
      },

      destroy() {
        if (destroyed) return
        destroyed = true
        cancelRender()
        video.removeEventListener('ended', handleEnded)
        video.pause()
        video.removeAttribute('src')
        video.load()
        video.remove()
        renderer.destroy()
      },
    }

    // Render scheduling — one GPU upload per *decoded* video frame via
    // requestVideoFrameCallback. The old rAF loop re-uploaded the full
    // video frame (~7MB here) on every display refresh (~60fps) even though
    // the video only decodes ~25-30 unique frames/sec, doubling texImage2D
    // bandwidth for zero visual gain. rAF is the fallback where rVFC is absent.
    function drawCurrentFrame() {
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        renderer.drawFrame(video)
      }
    }

    function scheduleFrame() {
      if (destroyed) return
      if (supportsRVFC) {
        usingRVFC = true
        frameHandle = rvfc.requestVideoFrameCallback!(onFrame)
      }
      else {
        usingRVFC = false
        frameHandle = requestAnimationFrame(onFrame)
      }
    }

    function onFrame() {
      if (destroyed) return
      drawCurrentFrame()
      scheduleFrame()
    }

    function cancelRender() {
      if (frameHandle === null) return
      if (usingRVFC) rvfc.cancelVideoFrameCallback?.(frameHandle)
      else cancelAnimationFrame(frameHandle)
      frameHandle = null
    }

    // Loop/completion is driven by the `ended` event, not by polling
    // `video.ended` in the loop: rVFC stops firing once playback ends, so a
    // poll-based check would never observe the final state.
    function handleEnded() {
      currentLoop++
      if (loopCount > 0 && currentLoop >= loopCount) {
        cancelRender()
        player.onEnd?.()
        return
      }
      // Loop again
      video.currentTime = 0
      video.play()
        .then(() => {
          drawCurrentFrame()
          scheduleFrame()
        })
        .catch(() => {})
    }

    video.addEventListener('ended', handleEnded)

    // Wait for video to be ready
    // IMPORTANT: Attach listeners BEFORE setting src to prevent race condition
    // where canplaythrough fires before the listener is registered (common on
    // page refresh when the video is already cached by the browser)
    // Resolve through the shared asset cache. getCachedVideoUrl checks L1/L2
    // only — it never downloads — so a cache hit yields an instant same-origin
    // blob (also removes the WebGL CORS dependency) while a miss returns the
    // network URL fast. On a miss we stream from the network (fast `canplay`
    // on a partial buffer, same as before) AND fill Cache Storage in the
    // background so the next play of this asset is instant. The background
    // preloadVideo dedupes (videoPending) with any pre-warm already in flight.
    let resolvedVideoUrl = videoUrl
    try {
      resolvedVideoUrl = await giftAssetCache.getCachedVideoUrl(videoUrl)
    }
    catch {
      resolvedVideoUrl = videoUrl
    }
    if (resolvedVideoUrl === videoUrl) {
      void giftAssetCache.preloadVideo(videoUrl).catch(() => {})
    }

    await new Promise<void>((resolve, reject) => {
      // If video is already loaded (cached), resolve immediately
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        resolve()
        return
      }
      video.addEventListener('canplay', () => {
        resolve()
      }, { once: true })
      video.addEventListener('error', () => {
        const mediaErr = video.error
        reject(new Error(`[VAP] Video load failed: ${videoUrl} (code: ${mediaErr?.code}, ${mediaErr?.message})`))
      }, { once: true })
      // Set src AFTER listeners are attached to avoid missing events
      video.src = resolvedVideoUrl
      video.load()
    })


    // Autoplay if requested
    if (options.autoplay ?? true) {
      player.start()
    }

    return player
  }

  return {
    provide: { vap: { createVapPlayer, preloadConfig, isCached } },
  }
} })
