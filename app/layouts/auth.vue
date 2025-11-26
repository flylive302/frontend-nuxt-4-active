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

    </div>
  </main>
</template>
<script setup lang="ts">
</script>