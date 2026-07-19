// ========================================
// DM Voice Recorder (dm-messenger-v2/04)
// ========================================
// Framework-free wrapper around MediaRecorder: mic permission is requested
// only on first use (start()), never eagerly. Mime negotiated from
// DM_VOICE_MIME_CANDIDATES via MediaRecorder.isTypeSupported — opus/webm
// where supported, MP4/AAC fallback on Safari/iOS WebView. Hard-stops at
// DM_VOICE_MAX_DURATION_MS.

import { DM_VOICE_MAX_DURATION_MS, DM_VOICE_MIME_CANDIDATES } from '~/constants/inbox'

export interface VoiceRecordingResult {
  blob: Blob
  mimeType: string
  durationMs: number
}

export interface VoiceRecorderHandle {
  /** Stop recording and resolve with the assembled blob + duration. */
  stop: () => Promise<VoiceRecordingResult>
  /** Abort recording — releases the mic, no result produced. */
  cancel: () => void
  /** Elapsed recording time in ms at the moment of calling. */
  elapsedMs: () => number
}

/** Picks the first MediaRecorder-supported mime from the candidate list. */
export function pickSupportedVoiceMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return null
  for (const candidate of DM_VOICE_MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }
  return null
}

/**
 * Requests mic access + starts recording. Rejects if getUserMedia or
 * MediaRecorder is unavailable/denied — caller (composer GATE) surfaces
 * that as a toast and never enters the `recording` state.
 */
export async function startVoiceRecording(onHardStop: (result: VoiceRecordingResult) => void): Promise<VoiceRecorderHandle> {
  const mimeType = pickSupportedVoiceMimeType()
  if (!mimeType) throw new Error('Voice recording is not supported on this device.')

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks: BlobPart[] = []
  const startedAt = Date.now()
  let settled = false
  let hardStopTimer: ReturnType<typeof setTimeout> | null = null

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  function releaseStream(): void {
    stream.getTracks().forEach(track => track.stop())
  }

  function buildResult(): VoiceRecordingResult {
    return {
      blob: new Blob(chunks, { type: mimeType }),
      mimeType,
      durationMs: Date.now() - startedAt,
    }
  }

  recorder.start()

  hardStopTimer = setTimeout(() => {
    if (settled || recorder.state === 'inactive') return
    settled = true
    recorder.addEventListener('stop', () => {
      releaseStream()
      onHardStop(buildResult())
    }, { once: true })
    recorder.stop()
  }, DM_VOICE_MAX_DURATION_MS)

  return {
    stop: () => new Promise((resolve, reject) => {
      if (settled) {
        reject(new Error('Recording already settled.'))
        return
      }
      settled = true
      if (hardStopTimer) clearTimeout(hardStopTimer)
      recorder.addEventListener('stop', () => {
        releaseStream()
        resolve(buildResult())
      }, { once: true })
      recorder.stop()
    }),
    cancel: () => {
      if (settled) return
      settled = true
      if (hardStopTimer) clearTimeout(hardStopTimer)
      if (recorder.state !== 'inactive') recorder.stop()
      releaseStream()
    },
    elapsedMs: () => Date.now() - startedAt,
  }
}
