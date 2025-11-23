<template>
  <main>
    <BackgroundDecorationsVariant1 />

    <nav class="px-3">
      <LogoLarge />

      <SectionTitle>Login With:</SectionTitle>

      <div class="flex justify-between mt-2">
        <UButton
            variant="subtle"
            size="xl"
            :avatar="{
              src: 'https://github.com/nuxt.png',
              class: 'size-8'
            }"
        />
        <UButton
            variant="subtle"
            size="xl"
            :avatar="{
              src: 'https://github.com/nuxt.png',
              class: 'size-8'
            }"
        />
        <UButton
            variant="subtle"
            size="xl"
            :avatar="{
              src: 'https://github.com/nuxt.png',
              class: 'size-8'
            }"
        />
      </div>

      <USeparator color="primary" class="my-4" label="OR" />

      <slot />

      <aside class="h-64" />
    </nav>
  </main>
</template>
<script setup lang="ts">
</script>