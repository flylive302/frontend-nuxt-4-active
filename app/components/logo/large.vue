<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
</script>

<template>
   <div class="flex flex-col">
      <NuxtImg
         :src="ASSETS.LOGO_MAIN"
         alt="Flylive Logo"
         class="mx-auto"
         width="256"
      />
      <NuxtImg
         :src="ASSETS.LOGO_TEXT"
         alt="Flylive Logo"
         class="mx-auto -mt-10 bg-black/30 rounded-lg"
         style="width: 150px"
      />
   </div>
</template>