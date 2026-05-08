<script setup lang="ts">
</script>
<template>
   <div class="flex flex-col">
      <img
         src="/logos/flylive-logo.webp"
         srcset="/logos/flylive-logo.webp 1x, /logos/flylive-logo-2x.webp 2x"
         sizes="256px"
         alt="Flylive"
         width="256"
         height="160"
         class="mx-auto"
         fetchpriority="high"
         loading="eager"
         decoding="async"
      >
      <img
         src="/logos/flylive-text.png"
         srcset="/logos/flylive-text.png 1x, /logos/flylive-text-2x.png 2x"
         alt="Flylive Text logo"
         aria-hidden="true"
         width="150"
         height="54"
         class="mx-auto -mt-10 bg-black/30 rounded-lg"
         fetchpriority="low"
         loading="eager"
         decoding="async"
      >
   </div>
</template>

<!-- srcset="/logos/flylive-logo.webp 1x, /logos/flylive-logo-2x.webp 2x" -->