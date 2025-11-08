<script setup lang="ts">
import { useRoute } from "vue-router";

definePageMeta({ layout: 'alt' })

const route = useRoute()
</script>

<template>
  <main>
    <NavAlt back-to="/profile">Agency</NavAlt>
    <div class="px-3 mt-12">
      Agency Name {{route.params.id}}
    </div>
  </main>
</template>