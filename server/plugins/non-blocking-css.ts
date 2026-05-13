export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('render:html', (html) => {
        html.head = html.head.map((chunk) =>
            chunk.replace(
                /<link rel="stylesheet" href="(\/_nuxt\/[^"]+\.css)"([^>]*)>/g,
                (_, href, rest) =>
                    `<link rel="preload" href="${href}" as="style"${rest} onload="this.onload=null;this.rel='stylesheet'">` +
                    `<noscript><link rel="stylesheet" href="${href}"${rest}></noscript>`
            )
        )
    })
})
