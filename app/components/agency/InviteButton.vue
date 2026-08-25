<script setup lang="ts">
/**
 * Reusable "Invite to Agency" button.
 *
 * INTENT (click) → GATE/EXECUTE (useAgencyInviteActions) → REACT (toasts, raised
 * inside the composable).
 *
 * Self-contained: it loads the viewer's own agency context on mount and renders
 * nothing unless that viewer owns an approved agency, so any surface (profile
 * page, member list, …) can drop it in with no surrounding wiring.
 */

defineOptions({ name: 'AgencyInviteButton' })

// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  /** User to invite into the viewer's agency. */
  userId: number | null | undefined
  /** Agency the target already belongs to — hides the button when it is ours. */
  agencyId?: number | null
  /** Button text; set to null/'' to render icon-only. */
  label?: string | null
  /** Button text once the invitation has been sent. */
  invitedLabel?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
}>(), {
  agencyId: null,
  label: 'Invite To Agency',
  invitedLabel: 'Invited',
  size: 'md',
  variant: 'subtle',
})

// ========================================
// Composables
// ========================================

const { canInvite, isSending, hasInvited, ensureAgencyContext, invite } = useAgencyInviteActions(
  () => props.userId,
  () => props.agencyId,
)

// ========================================
// Lifecycle
// ========================================

onMounted(ensureAgencyContext)
</script>

<template>
  <UButton
      v-if="canInvite"
      :loading="isSending"
      :disabled="isSending || hasInvited"
      :icon="hasInvited ? 'i-lucide-mail-check' : 'i-lucide-user-plus'"
      :size="size"
      :variant="variant"
      :color="hasInvited ? 'success' : 'primary'"
      class="pl-1 pr-2 gap-1 backdrop-blur-xs"
      @click="() => { invite() }"
  >
    {{ hasInvited ? invitedLabel : label }}
  </UButton>
</template>
