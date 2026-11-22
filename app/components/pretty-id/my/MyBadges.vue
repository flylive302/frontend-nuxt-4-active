<script setup lang="ts">
/**
 * "How your ID shows on your profile and in rooms": one row per ID the user
 * owns — their avatar, name and the small crowned badge. The parent decides
 * which IDs and in what order.
 */
defineProps<{
  name: string
  avatarUrl: string | null
  ids: string[]
}>()

// Constants
const RING_SIZE = 40
const BADGE_WIDTH = '112px'
/** IDs up to this many digits get the larger number. */
const SHORT_ID_MAX_LENGTH = 4
const NUMBER_SIZE_SHORT = 16
const NUMBER_SIZE_LONG = 11

// Helpers
function numberSize(id: string): number {
  return id.length > SHORT_ID_MAX_LENGTH ? NUMBER_SIZE_LONG : NUMBER_SIZE_SHORT
}
</script>

<template>
  <p v-if="ids.length === 0" class="pid-empty">Claim an ID to see your badges.</p>

  <template v-else>
    <p class="pid-body pid-small pid-muted mb-1.5 text-center">How your ID shows on your profile and in rooms</p>

    <PrettyIdRow v-for="id in ids" :key="id">
      <PrettyIdRing :src="avatarUrl" :size="RING_SIZE" />
      <span class="pid-row__grow pid-body text-base">{{ name }}</span>
      <PrettyIdBadge :id="id" :width="BADGE_WIDTH" :font-size="numberSize(id)" />
    </PrettyIdRow>
  </template>
</template>
