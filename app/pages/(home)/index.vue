<script setup lang="ts">
const items = [
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp'
]
</script>

<template>
  <div class="flex flex-col gap-8 px-3 py-18 max-w-screen">
    <BackgroundDecorationsVariant1 />

    <UCarousel
        v-slot="{ item }"
        loop
        class-names
        :items="items"
        :autoplay="{ delay: 3000 }"
        :ui="{
          item: 'basis-2/3 transition duration-300 ease-in-out [&:not(.is-snapped)]:scale-90'
        }"
        class=""
    >
      <RoomCard :image-src="item">
        Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
      </RoomCard>
    </UCarousel>

    <RoomCard image-src="siteAssets/room/room-card-top.webp">
      Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
    </RoomCard>

    <RoomCard class="w-2/4" image-src="siteAssets/room/room-card.webp">
      Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
    </RoomCard>

    <EventsBanners>
      <span class="pl-5">Weekly CP</span>
    </EventsBanners>

    <EventsBanners
        type="country"
        lUserName="First Winner"
        lFrameName="frames/9"
        rUserName="Second Winner"
        rFrameName="frames/9"
    >
      <span class="text-base">Country Event</span>
    </EventsBanners>

    <EventsBanners
      type="recharge_tycoon"
      lFrameName="frames/admin/super_admin"
      rFrameName="frames/admin/cs_leader"
      :lFrameGirth="50"
      :rFrameGirth="50"
    >
      <span class="text-sm">Recharge Tycoon</span>
    </EventsBanners>

    <Homeheader />

    <Footer />

    <div class="flex w-full mx-auto">
      <LazyAvatar
          frame_name="frames/5"
          class="w-30 mx-auto"
          :animated="true"
          :frame_girth="60"
      />

      <LazyAvatar
          frame_name="frames/19"
          class="w-25 mx-auto"
          :frame_girth="65"
          :animated="true"
      />
    </div>

    <LazySvgaPlayer hydrate-on-visible name="frames/9" class="w-2/4" />

    <LazySvgaPlayer hydrate-on-visible name="frames/gifts/castle" class="w-2/4" />

    <BgGlass>
      <h1 class="text-xl">Hello World</h1>
    </BgGlass>

    <LogoIcon />

    <LogoMain />

    <LogoLarge />

    <USeparator label="OR" color="primary" type="solid" />

    <SectionTitle>This is Section title</SectionTitle>
    <SectionTitle type="secondary">This is Section title</SectionTitle>
    <SectionTitle type="tertiary">This is Section title</SectionTitle>

    <USeparator label="OR" color="secondary" type="solid" />

    <h1 class="text-3xl">Hello Fly Live</h1>
    <p class="muted">
      ipsum dolor sit amet
      ipsum dolor sit amet
      ipsum dolor sit amet
    </p>

    <USeparator label="OR" color="tertiary" type="solid" />

    <div class="py-4 flex-wrap flex gap-4">
      <UButton color="primary" variant="subtle" class="shadow-lg/50 shadow-primary">
        Primary
      </UButton>

      <UButton color="secondary" class="shadow-lg/50 shadow-secondary" variant="subtle">
        Secondary
      </UButton>

      <UButton color="tertiary" class="shadow-lg/50 shadow-tertiary" variant="subtle">
        Tertiary
      </UButton>

      <UButton color="info" class="shadow-lg/50 shadow-info" variant="subtle">
        info
      </UButton>

      <UButton color="warning" class="shadow-lg/50 shadow-warning" variant="subtle">
        warning
      </UButton>

      <UButton color="error" class="shadow-lg/50 shadow-error" variant="subtle">
        error
      </UButton>

      <UButton color="neutral" class="shadow-lg/50 shadow-neutral-50" variant="subtle">
        neutral
      </UButton>
    </div>

  </div>
</template>

<style scoped>

</style>