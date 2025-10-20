<script setup lang="ts">
</script>

<template>
  <div class="px-3 pt-18 max-w-screen">
    <BackgroundDecorationsVariant1 />

    <EventsBanners lFrameName="frames/6" class="mb-8">
      <span class="pl-5">Weekly CP</span>
    </EventsBanners>

    <EventsBanners
      type="country"
      lUserName="First Winner"
      lFrameName="frames/9"
      :lOverFlow="160"
      rUserName="Second Winner"
      rFrameName="frames/6"
      :rOverFlow="160"
      :rtop="46"
      class="mb-8"
    >
      <span class="text-base">Country Event</span>
    </EventsBanners>

    <EventsBanners
      type="recharge_tycoon"
      lUserName="First Winner"
      lFrameName="frames/admin/admin"
      :lOverFlow="200"
      rUserName="Second Winner"
      rFrameName="frames/admin/bd"
      :rOverFlow="190"
      :rtop="46"
    >
      <span class="text-sm">Recharge Tycoon</span>
    </EventsBanners>

    <Homeheader />

    <Footer />

    <div class="flex w-full mx-auto my-8">
      <LazyAvatar
          frame_name="frames/5"
          class="w-30 mx-auto"
          :animated="true"
      />

      <LazyAvatar
          frame_name="frames/19"
          class="w-25 mx-auto"
          :top="50"
          :left="50"
          :frame_overflow="150"
          :frame_girth="20"
          :animated="true"
      />
    </div>

    <LazySvgaPlayer hydrate-on-visible name="frames/9" />

    <LazySvgaPlayer hydrate-on-visible name="frames/gifts/castle" />

    <BgGlass>
      <h1 class="text-xl">Hello World</h1>
    </BgGlass>

    <LogoIcon class="my-6" />

    <LogoMain class="mb-6" />

    <LogoLarge class="mb-6" />

    <USeparator label="OR" color="primary" type="solid" class="my-4" />

    <SectionTitle class="mb-6">This is Section title</SectionTitle>
    <SectionTitle class="mb-6" type="secondary">This is Section title</SectionTitle>
    <SectionTitle class="mb-6" type="tertiary">This is Section title</SectionTitle>

    <USeparator label="OR" color="secondary" type="solid" class="my-4" />

    <h1 class="text-3xl">Hello Fly Live</h1>
    <p class="muted">
      ipsum dolor sit amet
      ipsum dolor sit amet
      ipsum dolor sit amet
    </p>

    <USeparator label="OR" color="tertiary" type="solid" class="my-4" />

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