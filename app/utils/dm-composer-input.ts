// ========================================
// DM Composer Input — pure derivation (dm-messenger-v2/08)
// ========================================
// Mic <-> send morph and Enter/Shift+Enter keydown decisions for the
// composer bar. Pure functions only — no Vue reactivity, no DOM. Consumed
// by message-input.vue to keep it INTENT-only.

/** Which action the trailing button in the compose bar represents. */
export type ComposerMorphMode = 'mic' | 'send'

/** Mic when the textarea is empty/whitespace-only; send once real text is present. */
export function deriveComposerMorphMode(text: string): ComposerMorphMode {
  return text.trim() ? 'send' : 'mic'
}

/** Whether the current text is sendable (non-empty after trim). */
export function isComposerTextSendable(text: string): boolean {
  return text.trim().length > 0
}

/**
 * Whether a keydown event should trigger a send (Enter without Shift) vs.
 * fall through to the default newline-insert behavior (Shift+Enter).
 */
export function shouldSendOnKeydown(key: string, shiftKey: boolean): boolean {
  return key === 'Enter' && !shiftKey
}
