<script setup lang="ts">

</script>

<template>
  <div>
    <SectionTitle>Login With:</SectionTitle>

    <div class="flex justify-between mt-2">
      <UButton
          variant="subtle"
          size="xl"
          :square="true"
      >
        <UIcon name="i-logos-facebook" class="size-8"/>
      </UButton>
      <UButton
          variant="subtle"
          size="xl"
          :square="true"
      >
        <UIcon name="i-logos-google-icon" class="size-8"/>
      </UButton>
      <UButton
          variant="subtle"
          size="xl"
          :square="true"
      >
        <UIcon name="i-skill-icons-instagram" class="size-8"/>
      </UButton>
    </div>
  </div>
</template>

<style scoped>

</style>