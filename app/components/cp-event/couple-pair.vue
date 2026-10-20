<script setup lang="ts">
import type { CpPairCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'

// Binder LEFT, partner RIGHT. Variants:
//  - row:    compact list/self-bar entry (avatar · icon · avatar)
//  - podium: two cells with the signature id under each name
//  - hero:   profile layout (binding icon between, id badges)

const props = withDefaults(defineProps<{
  pair: CpPairCard
  variant?: 'row' | 'podium' | 'hero'
  /** Live SVGA frames (profile hero only). */
  animated?: boolean
}>(), {
  variant: 'row',
  animated: false,
})

const users = computed(() => [props.pair.binder, props.pair.partner] as const)

const wrapperClass = computed(() => ({
  row: 'flex justify-center',
  podium: 'grid grid-cols-2 gap-2',
  hero: 'grid grid-cols-3',
})[props.variant])
</script>

<template>
  <div :class="wrapperClass">
    <template v-for="(user, index) in users" :key="user.id">
      <div
        class="flex-col justify-center items-center text-center text-xs leading-none"
        :class="variant === 'row' ? 'w-15 flex' : ''"
      >
        <CpEventFrame :user="user" :animated="animated" />
        <MarqueeName text-class="font-bold leading-none" :name="user.name ?? 'User'" :vip="user.vip_level" />
        <p v-if="variant === 'podium'">ID: {{ user.signature }}</p>
        <ProfileBadge v-else-if="variant === 'hero' && user.signature" :txt="`ID: ${user.signature}`" :vip="user.vip_level" />
      </div>

      <div v-if="index === 0 && variant === 'row'" class="w-8 flex flex-col justify-center items-center">
        <img alt="" :src="ASSETS.CP_CONNECTION_ICON">
      </div>
      <div v-else-if="index === 0 && variant === 'hero'" class="flex flex-col justify-end">
        <img alt="" :src="ASSETS.CP_USER_BINDING_ICON" class="-ml-0.5">
      </div>
    </template>
  </div>
</template>
