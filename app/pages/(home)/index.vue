<script setup lang="ts">
</script>

<template>
  <div class="px-3">
    <BackgroundDecorationsVariant1 />

    <LazySvgaPlayer hydrate-on-visible name="frames/9" width="100%" height="auto" />

    <LazySvgaPlayer hydrate-on-visible name="frames/gifts/castle" width="100%" height="auto" />

    <LogoIcon class="mb-6" />

    <LogoMain class="mb-6" />

    <LogoLarge class="mb-6" />

    <USeparator label="OR" color="primary" type="solid" class="my-4" />

    <SectionTitle class="mb-6">This is Section title</SectionTitle>
    <SectionTitle class="mb-6" type="secondary">This is Section title</SectionTitle>
    <SectionTitle class="mb-6" type="tertiary">This is Section title</SectionTitle>

    <USeparator label="OR" color="secondary" type="solid" class="my-4" />

    <h1 class="text-3xl">Hello Fly Live</h1>
    <p class="muted">
      ipsum dolor sit amet
      ipsum dolor sit amet
      ipsum dolor sit amet
    </p>

    <USeparator label="OR" color="tertiary" type="solid" class="my-4" />

    <div class="py-4 flex-wrap flex gap-4">
      <UButton color="primary" variant="subtle" class="shadow-lg/50 shadow-primary">
        Primary
      </UButton>

      <UButton color="secondary" class="shadow-lg/50 shadow-secondary" variant="subtle">
        Secondary
      </UButton>

      <UButton color="tertiary" class="shadow-lg/50 shadow-tertiary" variant="subtle">
        Tertiary
      </UButton>

      <UButton color="info" class="shadow-lg/50 shadow-info" variant="subtle">
        info
      </UButton>

      <UButton color="warning" class="shadow-lg/50 shadow-warning" variant="subtle">
        warning
      </UButton>

      <UButton color="error" class="shadow-lg/50 shadow-error" variant="subtle">
        error
      </UButton>

      <UButton color="neutral" class="shadow-lg/50 shadow-neutral-50" variant="subtle">
        neutral
      </UButton>
    </div>

  </div>
</template>

<style scoped>

</style>