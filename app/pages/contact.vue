<script setup lang="ts">
definePageMeta({
  layout: 'auth',
  authHeading: 'Contact Support We reply in 24h',
})

useSeoMeta({
  title: 'Contact Support — FlyLive',
  description: 'Have a question or ran into a problem? Send a message to the FlyLive support team and we\'ll get back to you within 24 hours.',
  ogTitle: 'Contact Support — FlyLive',
  ogDescription: 'Have a question or ran into a problem? Send a message to the FlyLive support team and we\'ll get back to you within 24 hours.',
  ogType: 'website',
  robots: 'index, follow',
})
</script>

<template>
  <FormsContactForm />
</template>
