<script setup lang="ts">
/**
 * Complete Profile Data Page
 *
 * Thin page: route binding + layout only.
 * All logic lives in useProfileCompletion() composable.
 * All UI lives in <AuthProfileWizard /> component.
 */
definePageMeta({
  middleware: ['profile-completion']
})
</script>

<template>
  <AuthProfileWizard />
</template>
