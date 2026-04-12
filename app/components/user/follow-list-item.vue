<script setup lang="ts">
/**
 * Follow List Item Component.
 * Displays a user using MinimalUserList and provides a follow toggle button.
 * Follows the INTENT (click) -> GATE (useFollow) -> EXECUTE (api) -> REACT (toast/state) flow.
 */
import type { MinimalUser } from '~/types/user/bootstrap'
import { useFollow } from '~/composables/user/useFollow'

defineOptions({ name: 'UserFollowListItem' })

const props = defineProps<{
  user: MinimalUser
}>()

// ========================================
// Follow Logic (GATE/EXECUTE/REACT encapsulated)
// ========================================

// Pass a getter for the user ID to useFollow
const { isFollowing, isSelf, buttonLabel, toggleFollow, isToggling } = useFollow(() => props.user.id)

</script>

<template>
  <div class="px-2 py-1">
    <MinimalUserList :user="user">
      <template #default>
        <!-- Follow Action (only for other users) -->
        <div v-if="!isSelf" class="flex items-center justify-end pr-3">
          <UButton
            :label="buttonLabel"
            :color="isFollowing ? 'neutral' : 'primary'"
            :variant="isFollowing ? 'soft' : 'solid'"
            size="xs"
            class="min-w-24 justify-center font-bold"
            :loading="isToggling"
            @click.stop="toggleFollow"
          />
        </div>
      </template>
    </MinimalUserList>
  </div>
</template>

<style scoped>
</style>
