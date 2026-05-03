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
    // H.264 compression produces near-zero alpha artifacts in transparent areas.
    // Smooth-step threshold: values below 0.05 become fully transparent,
    // values above 0.15 pass through, with a smooth transition in between.
    float alpha = smoothstep(0.05, 0.15, rawAlpha);
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

  // First, test WebGL support on a tiny throwaway canvas.
  // This isolates whether the issue is the browser/GPU vs the specific canvas.
  const testCanvas = document.createElement('canvas')
  testCanvas.width = 1
  testCanvas.height = 1
  const testCtx = testCanvas.getContext('webgl', glOptions)
  if (!testCtx) {
    log.warn('WebGL not available on this device/browser. Check chrome://gpu for details.')
    testCanvas.remove()
    return null
  }
  // Release test context
  const glTestCtx = testCtx as WebGLRenderingContext
  const testExt = glTestCtx.getExtension('WEBGL_lose_context')
  testExt?.loseContext()
  testCanvas.remove()
  log.info('WebGL support confirmed via test canvas')

  // Now try on the actual canvas
  for (const name of ['webgl', 'webgl2', 'experimental-webgl'] as const) {
    try {
      const ctx = canvas.getContext(name, glOptions) as WebGLRenderingContext | null
      if (ctx) {
        log.info(`WebGL context acquired via "${name}"`, {
          renderer: ctx.getParameter(ctx.RENDERER),
          vendor: ctx.getParameter(ctx.VENDOR),
        })
        return ctx
      }
      log.warn(`getContext("${name}") returned null`)
    }
    catch (err: any) {
      log.warn(`getContext("${name}") threw:`, err?.message || err)
    }
  }

  log.error('WebGL test passed but failed on actual canvas — canvas may be tainted or too large')
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

  // Enable blending for transparency
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

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
      const ext = gl.getExtension('WEBGL_lose_context')
      ext?.loseContext()
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
        // H.264 produces artifact values 1-30 in "transparent" areas. Clamp to 0.
        const alpha = rawAlpha < 30 ? 0 : rawAlpha
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

export default defineNuxtPlugin(() => {
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

    log.info('Creating player:', { name: options.name, jsonUrl, videoUrl, loop: loopCount, muted: isMuted })

    // EXECUTE: Fetch config
    const config = await preloadConfig(jsonUrl)
    const { info } = config
    log.info('Config loaded:', { w: info.w, h: info.h, videoW: info.videoW, videoH: info.videoH })

    // EXECUTE: Set canvas dimensions to logical display size
    options.canvas.width = info.w
    options.canvas.height = info.h

    // EXECUTE: Initialize renderer (WebGL with 2D fallback)
    let renderer: Renderer

    const gl = tryGetWebGLContext(options.canvas)
    if (gl) {
      renderer = createWebGLRenderer(options.canvas, gl, info)
    }
    else {
      log.warn('WebGL unavailable — using 2D canvas software renderer (slower but compatible)')
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
    let animFrameId: number | null = null
    let currentLoop = 0
    let destroyed = false

    // Player instance
    const player: VapPlayer = {
      onStart: undefined,
      onEnd: undefined,
      onStop: undefined,

      start() {
        if (destroyed) return
        currentLoop = 0
        video.currentTime = 0
        log.info('Starting playback, muted:', video.muted)

        video.play().then(() => {
          log.info('Play succeeded (muted:', video.muted, ')')
          player.onStart?.()
          renderLoop()
        }).catch((err) => {
          log.warn('Play failed (muted:', video.muted, '):', err?.message || err)

          // Autoplay blocked — browser blocks unmuted autoplay without user gesture.
          // Fall back to muted playback so the animation at least renders.
          if (!video.muted) {
            log.info('Retrying with muted=true for autoplay compliance')
            video.muted = true
            video.play().then(() => {
              log.info('Muted fallback play succeeded')
              player.onStart?.()
              renderLoop()
            }).catch((err2) => {
              log.error('Muted fallback also failed:', err2?.message || err2)
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
          renderLoop()
        }).catch((err) => {
          log.warn('Restart play failed:', err?.message || err)
          if (!video.muted) {
            video.muted = true
            video.play().then(() => {
              player.onStart?.()
              renderLoop()
            }).catch(() => {})
          }
        })
      },

      destroy() {
        if (destroyed) return
        destroyed = true
        cancelRender()
        video.pause()
        video.removeAttribute('src')
        video.load()
        video.remove()
        renderer.destroy()
      },
    }

    // Render loop — uses whichever renderer was initialized
    function renderLoop() {
      if (destroyed) return

      if (video.ended) {
        currentLoop++
        if (loopCount > 0 && currentLoop >= loopCount) {
          // All loops done
          cancelRender()
          player.onEnd?.()
          return
        }
        // Loop again
        video.currentTime = 0
        video.play().catch(() => {})
      }

      // Draw current frame if video has data
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        renderer.drawFrame(video)
      }

      animFrameId = requestAnimationFrame(renderLoop)
    }

    function cancelRender() {
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId)
        animFrameId = null
      }
    }

    // Wait for video to be ready
    // IMPORTANT: Attach listeners BEFORE setting src to prevent race condition
    // where canplaythrough fires before the listener is registered (common on
    // page refresh when the video is already cached by the browser)
    log.info('Loading video:', videoUrl)
    await new Promise<void>((resolve, reject) => {
      // If video is already loaded (cached), resolve immediately
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        log.info('Video already cached, readyState:', video.readyState)
        resolve()
        return
      }
      video.addEventListener('canplay', () => {
        log.info('Video canplay fired, readyState:', video.readyState)
        resolve()
      }, { once: true })
      video.addEventListener('error', () => {
        const mediaErr = video.error
        log.error('Video load error:', { code: mediaErr?.code, message: mediaErr?.message, url: videoUrl })
        reject(new Error(`[VAP] Video load failed: ${videoUrl} (code: ${mediaErr?.code}, ${mediaErr?.message})`))
      }, { once: true })
      // Set src AFTER listeners are attached to avoid missing events
      video.src = videoUrl
      video.load()
    })

    log.info('Video loaded successfully, autoplay:', options.autoplay ?? true)

    // Autoplay if requested
    if (options.autoplay ?? true) {
      player.start()
    }

    return player
  }

  return {
    provide: { vap: { createVapPlayer, preloadConfig, isCached } },
  }
})
