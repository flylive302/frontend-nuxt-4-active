/**
 * Extend Nuxt UI color types to include custom colors defined in app.config.ts
 * 
 * This project uses Nuxt 4 + Nuxt UI 4 with custom colors.
 * The 'tertiary' color is defined in app/app.config.ts and maps to 'amber'.
 */

// Extend the Nuxt UI module augmentation for custom colors
declare module '@nuxt/ui' {
  interface NuxtUIColors {
    tertiary: string
  }
}

// Augment component prop types to accept 'tertiary'
type ExtendedColor = 'primary' | 'secondary' | 'tertiary' | 'info' | 'success' | 'warning' | 'error' | 'neutral'

export {}
