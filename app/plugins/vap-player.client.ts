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
 * Zero npm dependencies — uses native <video> + WebGL APIs.
 *
 * @see https://github.com/Tencent/vap
 */
import type { VapConfig, VapPlayer } from '~/types/asset/vap'

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
    float alpha = texture2D(u_video, aCoord).r;
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
   * @param options.canvas - Target canvas element for WebGL rendering
   * @param options.name - Base URL — resolves to {name}.mp4 + {name}.json
   * @param options.loop - Loop count (0 = infinite, 1 = play once)
   * @param options.autoplay - Whether to start immediately
   */
  const createVapPlayer = async (options: {
    canvas: HTMLCanvasElement
    name: string
    loop?: number
    autoplay?: boolean
    muted?: boolean
  }): Promise<VapPlayer> => {
    const jsonUrl = `${options.name}.json`
    const videoUrl = `${options.name}.mp4`
    const loopCount = options.loop ?? 1
    const isMuted = options.muted ?? true

    // EXECUTE: Fetch config
    const config = await preloadConfig(jsonUrl)
    const { info } = config

    // EXECUTE: Set canvas dimensions to logical display size
    options.canvas.width = info.w
    options.canvas.height = info.h

    // EXECUTE: Initialize WebGL
    const glContext = options.canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    })
    if (!glContext) throw new Error('[VAP] WebGL not supported')
    // Assign to non-nullable const so closures (renderLoop, stop, etc.) retain narrowing
    const gl: WebGLRenderingContext = glContext

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
        video.play().then(() => {
          player.onStart?.()
          renderLoop()
        }).catch((err) => {
          // Autoplay blocked — common on iOS first interaction
          console.warn('[VAP] Play failed:', err)
        })
      },

      stop() {
        if (destroyed) return
        cancelRender()
        video.pause()
        video.currentTime = 0
        // Clear canvas
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
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
        }).catch(() => {})
      },

      destroy() {
        if (destroyed) return
        destroyed = true
        cancelRender()
        video.pause()
        video.removeAttribute('src')
        video.load()
        video.remove()
        // Clean up WebGL resources
        gl.deleteTexture(texture)
        gl.deleteProgram(program)
        const ext = gl.getExtension('WEBGL_lose_context')
        ext?.loseContext()
      },
    }

    // Render loop
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

      // Upload current video frame as texture
      if (video.readyState >= video.HAVE_CURRENT_DATA) {
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      }

      // Draw
      gl.viewport(0, 0, options.canvas.width, options.canvas.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

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
    await new Promise<void>((resolve, reject) => {
      // If video is already loaded (cached), resolve immediately
      if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        resolve()
        return
      }
      video.addEventListener('canplay', () => resolve(), { once: true })
      video.addEventListener('error', () => reject(new Error(`[VAP] Video load failed: ${videoUrl}`)), { once: true })
      // Set src AFTER listeners are attached to avoid missing events
      video.src = videoUrl
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
})
