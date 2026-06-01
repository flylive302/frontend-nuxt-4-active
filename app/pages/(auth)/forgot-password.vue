<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  authHeading: 'Contact Support We reply ASAP',
  pageTransition: false,
  layoutTransition: false,
})

useSeoMeta({
  title: 'Contact Support — FlyLive',
  description: 'Send a message to the FlyLive support team. We respond within 24 hours.',
  ogTitle: 'Contact Support — FlyLive',
  ogDescription: 'Send a message to the FlyLive support team. We respond within 24 hours.',
  ogType: 'website',
  robots: 'index, follow',
})
</script>

<template>
  <FormsContactForm default-category="password_reset" />
</template>
