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
 * Whether follow counts should link to the follows page.
 * Clickable if: own profile OR target user has public follow list.
 */
const isClickable = computed(() => props.isOwnProfile || props.isFollowListPublic)

const followsLink = computed(() => {
  if (!isClickable.value || !props.userId) return undefined
  return `/profile/follows?user=${props.userId}`
})
</script>

<template>
  <div class="relative z-30 grid grid-cols-5 text-sm text-center font-bold leading-none">
    <p> {{ formatCurrency(charmXp) }} <br> Gifts In </p>

    <component
      :is="followsLink ? 'NuxtLink' : 'p'"
      :to="followsLink ? `${followsLink}&tab=following` : undefined"
      :class="{ 'text-primary underline underline-offset-2': followsLink }"
    >
      {{ formatCurrency(following) }} <br> Following
    </component>

    <p> {{ formatCurrency(visits) }} <br> Visits </p>

    <component
      :is="followsLink ? 'NuxtLink' : 'p'"
      :to="followsLink ? `${followsLink}&tab=followers` : undefined"
      :class="{ 'text-primary underline underline-offset-2': followsLink }"
    >
      {{ formatCurrency(followers) }} <br> Followers
    </component>

    <p> {{ formatCurrency(wealthXp) }} <br> Gift Out</p>
  </div>
</template>