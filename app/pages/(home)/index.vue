<script setup lang="ts">
import {number} from "#nuxt-scripts/validation/mock";

const items = [
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp'
]

// ---- Types
type CardType = 'cp' | 'country' | 'pretty_id' | 'recharge_tycoon' | 'supreme_recharge'
interface Banner {
  type: CardType

  lUserName?: string
  lFrameName?: string
  lAvatar?: string
  lFrameGirth?: number
  lTop?: number

  rUserName?: string
  rFrameName?: string
  rAvatar?: string
  rFrameGirth?: number
  rTop?: number

  textClass?: string
  text?: string
}

const banners: Banner[] = [
  {
    type: 'cp',
    lUserName: 'Noah',
    lFrameName: '',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Luna',
    rFrameName: '',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'pl-5',
    text: 'Weekly Cp'
  },
  {
    type: 'country',
    lUserName: 'Ali',
    lFrameName: 'frames/9',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Nora',
    rFrameName: 'frames/9',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-base',
    text: 'Country Event'
  },
  {
    type: 'recharge_tycoon',

    lUserName: 'Darwaish',
    lFrameName: 'frames/6',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Hori',
    rFrameName: 'frames/6',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-sm',
    text: 'Recharge tycoon'
  },
  {
    type: 'supreme_recharge',

    lUserName: 'Aria',
    lFrameName: 'frames/12',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Junie',
    rFrameName: 'frames/12',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-base',
    text: 'Supreme'
  },
  {
    type: 'pretty_id',

    lUserName: 'Mina',
    lFrameName: 'frames/16',
    lAvatar: '',
    lFrameGirth: 70,
    lTop: 50,

    rUserName: 'Aniya',
    rFrameName: 'frames/16',
    rAvatar: '',
    rFrameGirth: 70,
    rTop: 50,

    textClass: 'text-sm',
    text: 'Pretty ID 💖'
  },
]
</script>

<template>
  <div class="flex flex-col gap-8 px-3 py-14 max-w-screen">
    <BackgroundDecorationsVariant1 />

    <UCarousel
        class-names
        :autoplay="{ delay: 4000 }"
        :items="banners"
        :ui="{
          container: 'pt-4',
          item: 'basis-1/1 transition duration-500 ease-in-out [&:not(.is-snapped)]:scale-50'
        }"
        class="w-full"
    >
      <template #default="{ item }">
        <EventsBanners
            v-bind="{
              ...(item.lUserName ? { lUserName: item.lUserName } : {}),
              ...(item.lFrameName ? { lFrameName: item.lFrameName } : {}),
              ...(item.lFrameGirth ? { lFrameGirth: item.lFrameGirth } : {}),
              ...(item.rUserName ? { rUserName: item.rUserName } : {}),
              ...(item.rFrameName ? { rFrameName: item.rFrameName } : {}),
              ...(item.rFrameGirth ? { rFrameGirth: item.rFrameGirth } : {})
            }"
            :type="item.type"
        >
          <span :class="item.textClass">{{ item.text }}</span>
        </EventsBanners>
      </template>
    </UCarousel>

    <UCarousel
        v-slot="{ item }"
        class-names
        :items="items"
        :autoplay="{ delay: 3000 }"
        :ui="{
          item: 'basis-2/3 transition duration-300 ease-in-out [&:not(.is-snapped)]:scale-90'
        }"
        class=""
    >
      <RoomCard :imageSrc="item">
        Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
      </RoomCard>
    </UCarousel>

    <RoomCard image-src="siteAssets/room/room-card-top.webp">
      Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
    </RoomCard>

    <RoomCard class="w-2/4" image-src="siteAssets/room/room-card.webp">
      Live <span aria-hidden="true">/</span> <span class="tabular-nums">24</span>
    </RoomCard>

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