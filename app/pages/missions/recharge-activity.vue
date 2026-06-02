<script setup lang="ts">
import { RECHARGE_ACTIVITY} from "~/constants/assets";

definePageMeta({ layout: 'alt', middleware: 'auth' });
</script>

<template>
  <div class="w-full relative">
    <img :src="RECHARGE_ACTIVITY.banner" alt="recharge activity" class="w-full" />
  </div>
</template>

<style scoped>

</style>