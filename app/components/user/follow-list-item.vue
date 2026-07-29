<script setup lang="ts">
/**
 * Follow List Item Component.
 * Displays a user using MinimalUserList and provides a follow toggle button.
 * Follows the INTENT (click) -> GATE (useFollow) -> EXECUTE (api) -> REACT (toast/state) flow.
 */
import type { FollowListUser } from '~/types/user/bootstrap'
import { useFollow } from '~/composables/user/useFollow'
import UserTrackButton from "~/components/user/track-button.vue";

defineOptions({ name: 'UserFollowListItem' })

const props = defineProps<{
  user: FollowListUser
}>()

// ========================================
// Follow Logic (GATE/EXECUTE/REACT encapsulated)
// ========================================


const { isFollowing, isToggling, statusLoaded, buttonLabel, buttonIcon, isSelf, toggleFollow } = useFollow(props.user.id)

// Shared follow celebration (styles live globally in assets/css/main.css)
const { followAnimating, burst } = useFollowBurst()

/** Follow / follow-back, plus the burst animation on a *new* follow only. */
async function handleFollowClick(): Promise<void> {
  const wasFollowing = isFollowing.value
  await toggleFollow()

  if (!wasFollowing && isFollowing.value) {
    burst()
  }
}

</script>

<template>
  <div class="px-2 py-1">
    <MinimalUserList :user="user">
      <template #actions>
        <!-- Follow Action (only for other users) -->
        <div class="flex items-center">
          <UButton
              v-if="!isSelf"
              class="rounded-none follow-btn w-full justify-center transition-all duration-150"
              :class="{
                'follow-btn--animating': followAnimating,
                'bg-primary': isFollowing,
              }"
              variant="subtle"
              :label="buttonLabel"
              :loading="!statusLoaded || isToggling"
              :icon="buttonIcon"
              @click="handleFollowClick"
          />

          <UButton :to="`/inbox?start=${user.signature}`" icon="i-lucide-message-circle-more" variant="subtle" class="w-full rounded-none justify-center">
            Chat
          </UButton>

          <UserTrackButton
              :user-id="user.id"
              :name="user.name"
              class="w-full rounded-none justify-center"
          />
        </div>
      </template>
    </MinimalUserList>
  </div>
</template>

<style scoped>
</style>
