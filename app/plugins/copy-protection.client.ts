// Blocks copying, cutting, right-click / long-press context menus, and image
// drag across the whole app (web + Capacitor WebView). The CSS counterpart
// (user-select: none, -webkit-touch-callout: none, user-drag: none) lives in
// assets/css/main.css. Editable fields stay usable — typing/editing is never
// affected; only the copy/cut/context-menu affordances are suppressed.
export default defineNuxtPlugin(() => {
  const block = (event: Event) => {
    event.preventDefault()
  }

  // copy / cut fire on Ctrl+C/X and the native context-menu "Copy" item.
  document.addEventListener('copy', block)
  document.addEventListener('cut', block)

  // Right-click (desktop) + long-press context menu (Android WebView).
  document.addEventListener('contextmenu', block)

  // Native image drag / drag-to-save.
  document.addEventListener('dragstart', block)
})
