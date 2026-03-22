<script setup lang="ts">
/**
 * Complete Profile Data Page
 *
 * Thin page: route binding + layout only.
 * All logic lives in useProfileCompletion() composable.
 * All UI lives in <AuthCompleteProfileForm /> component.
 */
definePageMeta({
  layout: 'auth',
  middleware: ['profile-completion']
})
</script>


<template>
  <main>
    <AuthCompleteProfileForm />
  </main>
</template>
