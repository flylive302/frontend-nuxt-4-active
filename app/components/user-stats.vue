<script setup lang="ts">
withDefaults(defineProps<{
  follow?: string
  fans?: string
  giftIn?: string
  giftOut?: string
  visits?: string
}>(), {
  follow: '000',
  fans: '000',
  giftIn: '000',
  giftOut: '000',
  visits: '000',
})
</script>

<template>
  <div class="relative z-30 grid grid-cols-5 text-sm text-center font-bold leading-none">
    <p> {{ giftIn }} <br> Gifts In </p>
    <p> {{ follow }} <br> follow </p>
    <p> {{ visits }} <br> Visits </p>
    <p> {{ fans }} <br> fans </p>
    <p> {{ giftOut }} <br> Gift Out</p>
  </div>
</template>