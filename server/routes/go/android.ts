import { sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
    const config = useRuntimeConfig(event)
    const target = config.playStoreUrl || '/sign-up'
    await sendRedirect(event, target, 302)
})
