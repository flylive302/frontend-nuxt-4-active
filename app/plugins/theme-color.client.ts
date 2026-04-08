function ensureThemeColorMeta(): HTMLMetaElement {
  let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  return meta
}

function setThemeColor(color: string) {
  ensureThemeColorMeta().setAttribute('content', color)
}

export default defineNuxtPlugin((nuxtApp) => {
  // Transparent status bar on Android/Chrome when possible.
  const transparent = '#00000000'

  const apply = () => setThemeColor(transparent)

  nuxtApp.hook('app:mounted', apply)
  nuxtApp.hook('page:finish', apply)
})

