// Type declarations for @nuxt/image to resolve module aliases during type checking
// These modules are provided by Nuxt at runtime, but TypeScript needs declarations
// when checking .vue files in node_modules/@nuxt/image

// Reference Nuxt's app types
/// <reference types="nuxt/app" />

// Declare #imports module with the specific exports needed by @nuxt/image
// This avoids circular dependencies by not re-exporting from .nuxt/imports.d.ts
declare module '#imports' {
  // Import the actual types from Nuxt's composables
  import type { UseHeadInput } from '#app/composables/head'
  import type { H3Event } from 'h3'
  
  // Declare the specific functions used by @nuxt/image
  export function useHead(input: UseHeadInput): void
  export function useRequestEvent(): H3Event | undefined
  // Re-export everything else from the generated imports (this will be resolved at runtime)
  export * from '../.nuxt/imports'
}

// Declare #app/nuxt module
declare module '#app/nuxt' {
  import type { NuxtApp } from 'nuxt/app'
  
  // Declare the specific function used by @nuxt/image
  export function useNuxtApp(): NuxtApp
  // Re-export everything else
  export * from 'nuxt/dist/app/nuxt'
}
