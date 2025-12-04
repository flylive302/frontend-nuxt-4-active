<template>
  <main>
    <BackgroundDecorationsVariant1 />

    <div class="px-3 mb-28">
      <LogoLarge />

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

      <USeparator color="primary" class="my-4" label="OR" />

      <slot />

    </div>
  </main>
</template>
<script setup lang="ts">
</script>