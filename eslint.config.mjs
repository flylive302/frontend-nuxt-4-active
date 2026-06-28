// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Ignore generated Capacitor/Android build artifacts
  { ignores: ['android/**'] },
)
