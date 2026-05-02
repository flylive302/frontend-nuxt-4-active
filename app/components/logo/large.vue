<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
</script>

<template>
   <div class="flex flex-col">
      <NuxtImg
         :src="ASSETS.LOGO_MAIN"
         alt="Flylive Logo"
         class="mx-auto w-64"
      />
      <NuxtImg
         :src="ASSETS.LOGO_TEXT"
         alt="Flylive Logo"
         class="mx-auto w-32 -mt-10 bg-black/30 rounded-lg"
      />
   </div>
</template>