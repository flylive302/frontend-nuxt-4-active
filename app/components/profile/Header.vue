<script setup lang="ts">
// ProfileHeader component — encapsulates the cover / avatar / badges / name / stats layout
</script>

<template>
  <div class="relative w-full">
    <slot name="cover" />

    <div class="bg-neutral-900 relative z-10 -mt-4 h-25 rounded-t-4xl">
      <div class="flex justify-center w-full gap-3">
        <slot name="signature-badges" />

        <slot name="avatar" />

        <div class="flex gap-2">
          <slot name="badges" />
        </div>
      </div>

      <h1 class="text-lg font-bold text-center">
        <slot name="name" />
      </h1>

      <slot name="stats" />
    </div>
  </div>
</template>
