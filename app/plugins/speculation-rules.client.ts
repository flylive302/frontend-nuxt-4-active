// Speculation Rules API — prerender likely next pages while user is idle.
// Chrome 109+. Gracefully ignored by all other browsers.
// "moderate" eagerness = prerender on hover/focus, not immediately,
// so we don't waste resources for users who never click through.
export default defineNuxtPlugin(() => {
  if (!HTMLScriptElement.supports?.('speculationrules')) return

  const script = Object.assign(document.createElement('script'), {
    type: 'speculationrules',
    textContent: JSON.stringify({
      prerender: [
        {
          urls: ['/'],
          eagerness: 'moderate',
        },
      ],
    }),
  })

  document.head.appendChild(script)
})
