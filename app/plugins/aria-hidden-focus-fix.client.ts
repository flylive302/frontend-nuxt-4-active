// Reka UI sets aria-hidden="true" on the dialog during the close animation
// while a focused descendant (e.g. the button that triggered the close) still
// holds focus. The browser blocks that focus from AT users and logs a warning.
// Fix: whenever aria-hidden="true" lands on a role="dialog" element, blur any
// focused descendant immediately so focus lands on the body instead.
export default defineNuxtPlugin(() => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName !== 'aria-hidden') continue

      const target = mutation.target as HTMLElement
      if (target.getAttribute('aria-hidden') !== 'true') continue
      if (target.getAttribute('role') !== 'dialog') continue
      if (!target.contains(document.activeElement)) continue

      ;(document.activeElement as HTMLElement).blur?.()
    }
  })

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    subtree: true,
  })
})
