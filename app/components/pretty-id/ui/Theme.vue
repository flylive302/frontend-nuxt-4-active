<script setup lang="ts">
/**
 * Theme root of the Pretty ID event. Loads the event stylesheet (tokens, fonts,
 * typography helpers) and injects the frame-art custom properties that the
 * stylesheet and every primitive read.
 *
 * Mounted once by <PrettyIdShell> for the page, and once inside each overlay
 * that teleports to <body> (<PrettyIdModal>, <PrettyIdSheet>) — teleported
 * content is outside the layout root, so it would otherwise lose the theme.
 */
import '~/assets/css/pretty-id.css'
import { PRETTY_ID_THEME_VARS } from '~/constants/pretty-id-theme'
</script>

<template>
  <div class="pid" :style="PRETTY_ID_THEME_VARS">
    <slot />
  </div>
</template>
