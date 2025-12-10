<script setup lang="ts">
definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

const items = [
  {
    label: 'Frames',
    slot: 'frames'
  },
  {
    label: 'Entries',
    slot: 'entries'
  },
  {
    label: 'Chat Bubbles',
    slot: 'chat_bubble'
  },
  {
    label: 'Unique ID',
    slot: 'unique_ids'
  }
]
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/mall/" second-link="/mall/my-props">
      <template #first-link-text>Props</template>
      <template #second-link-text>My Props</template>
    </NavAlt>

    <AltHero class="z-10" image-src="/siteAssets/alt-hero/secondary.webp">
      <div class="p-2 bg-gradient-to-br to-secondary/30">
        <UserAvatar :animated="true" class="max-w-[40vw] mx-auto " />
      </div>
    </AltHero>

    <div class="px-3 mb-32 overflow-hidden">
      <UTabs
          color="neutral"
          size="sm" class="mt-6"
          :ui="{
              trigger: '!text-white !font-bold data-[state=active]:border border-secondary data-[state=active]:bg-gradient-to-br to-secondary',
              list: 'bg-transparent',
          }"
          :items="items"
      >
        <template #frames>
          <div class="grid grid-cols-2 gap-2">
            <CardProps />
            <CardProps />
            <CardProps />
            <CardProps />
            <CardProps />
            <CardProps />
          </div>
        </template>

        <template #entries>
          <div class="grid grid-cols-2 gap-2">
            <CardProps />
            <CardProps />
            <CardProps />
          </div>
        </template>

        <template #chat_bubble>
          <div class="grid grid-cols-2 gap-2">
            <CardProps />
            <CardProps />
          </div>
        </template>

        <template #unique_ids>
          <div class="grid grid-cols-2 gap-2">
            <CardProps />
            <CardProps />
          </div>
        </template>
      </UTabs>
    </div>

  </main>
</template>

<style scoped>

</style>