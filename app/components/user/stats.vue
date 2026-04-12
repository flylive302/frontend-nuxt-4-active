<script setup lang="ts">
const props = withDefaults(defineProps<{
  followers?: string
  following?: string
  wealthXp?: string
  charmXp?: string
  visits?: string
  userId?: number | null
  isFollowListPublic?: boolean
  isOwnProfile?: boolean
}>(), {
  followers: '0',
  following: '0',
  wealthXp: '000',
  charmXp: '000',
  visits: '000',
  userId: null,
  isFollowListPublic: true,
  isOwnProfile: false,
})

/**
 * Compute the specific links for followers and following tabs.
 * Includes the target user ID and the specific tab to activate.
 */
const isClickable = computed(() => props.isOwnProfile || props.isFollowListPublic)

/**
 * Compute the specific links for followers and following tabs.
 * Includes the target user ID and the specific tab to activate.
 */
const followersLink = computed(() => {
  if (!isClickable.value || !props.userId) return undefined
  return `/profile/follows?user=${props.userId}&tab=followers`
})

const followingLink = computed(() => {
  if (!isClickable.value || !props.userId) return undefined
  return `/profile/follows?user=${props.userId}&tab=following`
})
</script>

<template>
  <div class="relative z-30 grid grid-cols-5 text-sm text-center font-bold leading-none">
    <p> {{ formatCurrency(charmXp) }} <br> Gifts In </p>

    <!-- Following Stat -->
    <NuxtLink
      v-if="followingLink"
      :to="followingLink"
      class="hover:text-primary transition-colors"
    >
      {{ formatCurrency(following) }} <br> Following
    </NuxtLink>
    <p v-else class="text-muted/60 cursor-not-allowed">
      {{ formatCurrency(following) }} <br> Following
    </p>

    <p> {{ formatCurrency(visits) }} <br> Visits </p>

    <!-- Followers Stat -->
    <NuxtLink
      v-if="followersLink"
      :to="followersLink"
      class="hover:text-primary transition-colors"
    >
      {{ formatCurrency(followers) }} <br> Followers
    </NuxtLink>
    <p v-else class="text-muted/60 cursor-not-allowed">
      {{ formatCurrency(followers) }} <br> Followers
    </p>

    <p> {{ formatCurrency(wealthXp) }} <br> Gift Out</p>
  </div>
</template>