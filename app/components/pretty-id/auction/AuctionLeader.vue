<script setup lang="ts">
/**
 * The leading bidder of a live auction: avatar, name and Signature (the user id stays in the payload for "am I leading" and is not shown).
 * Tapping opens their profile (when their Signature is known).
 */
import type { PrettyIdAuctionUser } from '~/types/pretty-id-auction'
import { prettyIdProfileRoute } from '~/utils/pretty-id-auction'

// Config
const props = defineProps<{
  leader: PrettyIdAuctionUser
}>()

// Constants
const AVATAR_SIZE = 56

// State
const profileRoute = computed(() => prettyIdProfileRoute(props.leader.signature))

// Handlers
function openProfile(): void {
  if (profileRoute.value) void navigateTo(profileRoute.value)
}
</script>

<template>
  <component
    :is="profileRoute ? 'button' : 'div'"
    :type="profileRoute ? 'button' : undefined"
    class="flex w-full items-center gap-3 px-2 py-1 text-left"
    :class="{ 'cursor-pointer': profileRoute }"
    :aria-label="profileRoute ? `Open ${leader.name}'s profile` : undefined"
    @click="openProfile"
  >
    <PrettyIdRing :src="leader.avatar" :size="AVATAR_SIZE" />
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="pid-body truncate">{{ leader.name }}</span>
      <PrettyIdPlate v-if="leader.signature" class="self-start">
        <span class="pid-num pid-gold text-[15px]">{{ leader.signature }}</span>
      </PrettyIdPlate>
    </span>
  </component>
</template>
