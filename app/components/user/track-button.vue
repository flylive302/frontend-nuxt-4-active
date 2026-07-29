<script setup lang="ts">
/**
 * Reusable "Track" button.
 *
 * INTENT (click) → GATE/EXECUTE (useTrackUser: socket lookup + room entry) →
 * REACT (toasts inside the composable).
 *
 * Self-contained: it owns its own `useRoomEntry()` instance and renders the
 * password prompt itself, so any surface (profile page, follow list, …) can
 * drop it in without wiring room-entry state.
 */

// `inheritAttrs: false` because this renders two roots (button + modal) — attrs
// are bound to the button explicitly so callers can restyle it (NuxtUI merges
// the incoming `class` with the defaults below via tailwind-merge).
defineOptions({ name: 'UserTrackButton', inheritAttrs: false })

const props = withDefaults(defineProps<{
  /** User to track into their current room. */
  userId: number | null | undefined
  /** Display name used by the "not in a room" toast. */
  name?: string | null
  /** Button text; set to null/'' to render icon-only. */
  label?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
}>(), {
  name: null,
  label: 'Track',
  size: 'md',
  variant: 'subtle',
})

const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
const { isTracking, trackUserById } = useTrackUser(enterRoom)

async function handleClick(): Promise<void> {
  if (!props.userId) return
  await trackUserById(props.userId, props.name)
}
</script>

<template>
  <UButton
      :loading="isTracking"
      :disabled="isTracking || !userId"
      icon="i-mdi-airplane-search"
      :size="size"
      :variant="variant"
      class="pl-1 pr-2 gap-1 backdrop-blur-xs"
      v-bind="$attrs"
      @click="handleClick"
  >
    {{ label }}
  </UButton>

  <!-- Password Prompt Modal (for password-protected rooms) -->
  <RoomPasswordPromptModal
      v-if="showPasswordPrompt && pendingRoom"
      v-model:open="showPasswordPrompt"
      :room="pendingRoom"
      @success="onPasswordSuccess"
  />
</template>
