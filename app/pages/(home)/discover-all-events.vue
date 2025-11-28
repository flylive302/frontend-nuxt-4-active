<script setup lang="ts">
definePageMeta({
  layout: 'home',
  middleware: 'auth'
})

</script>

<template>
  <main>
    <SectionTitle class="px-3">Discover all events</SectionTitle>
    <div class="flex flex-col gap-8 px-3 mt-6 pb-24">
      <EventsBanners >
        <span class="text-base pl-2">Weekly CP</span>
      </EventsBanners>

      <EventsBanners
          type="country"
          l-user-name="Ali Raza"
          l-frame-name="frames/6"
          r-user-name="Haniya"
          r-frame-name="frames/6"
      >
        <span class="text-base">Country Event</span>
      </EventsBanners>

      <EventsBanners
          type="recharge_tycoon"
          l-user-name="Darkish"
          l-frame-name="frames/9"
          r-user-name="Hori"
          r-frame-name="frames/9"
      >
        <span class="text-sm">Recharge Tycoon</span>
      </EventsBanners>

      <EventsBanners
          type="supreme_recharge"
          l-user-name="Aria"
          l-frame-name="frames/12"
          r-user-name="Junie"
          r-frame-name="frames/12"
      >
        <span class="text-base">Supreme</span>
      </EventsBanners>

      <EventsBanners
          type="pretty_id"
          l-user-name="Aria"
          l-frame-name="frames/12"
          r-user-name="Junie"
          r-frame-name="frames/12"
      >
        <span class="text-base">Pretty ID 💖</span>
      </EventsBanners>
    </div>
  </main>
</template>
