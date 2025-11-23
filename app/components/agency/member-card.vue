<script setup lang="ts">

withDefaults(defineProps<{
  id?: string
  name?: string
  signature?: string
  wealthBadge?: string
  charmBadge?: string
  gender?: string
  avatar?: string
  frameName?: string
  img?: string          // avatar url
  top?: number          // % for absolute center point
  left?: number         // % for absolute center point
  frameGirth?: number
  animated?: boolean
  staticSrc?: string
}>(), {
  id: 'abc-01',
  name: 'User Name',
  signature: 'UserSignature',
  wealthBadge: '1',
  charmBadge: '12',
  gender: 'male',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Digital%20Horizon',
  frameName: 'frames/1',
  img: '/avatars/placeholder',
  top: 50,
  left: 50,
  frameGirth: 70,
  animated: true,
  staticSrc: 'siteAssets/frames/ladies-frame.webp'
})
</script>

<template>
  <div class="grid grid-cols-13 bg-gradient-to-br to-primary/40 border-2 border-primary rounded-md">
    <div class="col-span-3 flex flex-col justify-center">
      <UserAvatar
          :animated="animated"
          :frame-name="frameName"
          :top="top"
          :left="left"
          :frame-girth="frameGirth"
          :img="img"
      />
    </div>
    <div class="col-span-10">
      <div class="flex items-baseline gap-2">
        <h3 class="text-sm font-bold">{{ name }}</h3>
        <p class="text-sm font-bold leading-none ml-auto flex items-center">
          <icon v-if="gender === 'male'" name="i-lucide-mars" />
          <icon v-if="gender === 'female'" name="i-lucide-venus" />
          <icon v-if="gender === 'others'" name="i-lucide-venus-and-mars" />
          {{ gender }}
        </p>
        <UButton
            icon="i-lucide-eye"
            :to="`/profile/owner-${id}/`"
            variant="subtle"
            size="xs"
            class="rounded-none shadow-md shadow-primary-900/60"
        >
          Visit
        </UButton>
      </div>
      <div class="flex items-center gap-1 mt-1">
        <ProfileBadge :txt="signature" />
        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" :txt="wealthBadge"/>
        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" :txt="charmBadge"/>
      </div>
    </div>
  </div>
</template>