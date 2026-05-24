<script setup lang="ts">
// ProfileHeader component — encapsulates the cover / avatar / badges / name / stats layout
</script>

<template>
  <div class="relative w-full">
    <slot name="cover" />

    <div class="bg-neutral-900 relative z-10 -mt-6 rounded-t-4xl">
      <div class="flex justify-center w-full gap-3">
        <div class="w-full flex items-center justify-center">
          <slot name="signature-badges" />
        </div>

        <slot name="avatar" />

        <div class="flex w-full">
          <slot name="badges" />
        </div>
      </div>

      <h1 class="text-lg font-bold text-center">
        <slot name="name" />
      </h1>

      <div class="m-3 rounded-xl glowing-border overflow-hidden">
        <slot name="stats" />
      </div>
    </div>
  </div>
</template>
