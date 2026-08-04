// ========================================
// Agency Invite Actions Composable
// ========================================

import type { MaybeRefOrGetter } from 'vue'

// ========================================
// Module State
// ========================================

/**
 * Which auth user the agency context was last fetched for.
 *
 * Module-scoped so `GET /user/agency` fires once per session instead of on every
 * profile view. The store has no `loaded` flag and `agency === null` cannot
 * double as one — that is the legitimate resting state for the majority of
 * users (non-members), so it would re-fetch forever. Keyed on the user id so a
 * logout → login pair re-fetches rather than inheriting the previous user's
 * ownership.
 */
const loadedForUserId = ref<number | null>(null)

// ========================================
// Composable
// ========================================

/**
 * Invite another user into the agency the current user owns.
 *
 * GATE (`canInvite`) → EXECUTE (`invite` → useAgencyInvitations.sendInvitation)
 * → REACT (toasts, raised inside sendInvitation).
 *
 * Gated on ownership only. The API also accepts agency admins
 * (`ManagesUserAgency::getUserManagedAgency` + `AgencyInvitationPolicy::create`),
 * so widening this to `store.isAgencyAdmin` needs no backend change.
 *
 * @param userId - The user being invited (the profile being viewed).
 * @param targetAgencyId - The agency that user already belongs to, if any.
 */
export function useAgencyInviteActions(
  userId: MaybeRefOrGetter<number | null | undefined>,
  targetAgencyId?: MaybeRefOrGetter<number | null | undefined>,
) {
  const store = useAgencyStore()
  const authStore = useAuthStore()
  const { sendInvitation } = useAgencyInvitations()
  const { fetchUserAgency } = useAgencyMembership()

  // ========================================
  // State
  // ========================================

  const isSending = ref(false)
  const hasInvited = ref(false)

  // A profile → profile navigation reuses the same component instance, so the
  // sent state has to follow the target rather than the mount.
  watch(() => toValue(userId), () => {
    hasInvited.value = false
  })

  // ========================================
  // GATE
  // ========================================

  /**
   * Every condition here mirrors one the API enforces, so a visible button is
   * never a guaranteed rejection:
   * - owner of an agency          → getUserManagedAgency / policy `create`
   * - agency approved             → Agency::isOperational (APPROVED only)
   * - target is not the auth user → self-invite is meaningless
   * - target is not already ours  → InviteMemberAction rejects hasMember (422)
   *
   * A target who belongs to a *different* agency stays invitable — `hasMember`
   * is scoped to the inviting agency, so recruiting across agencies is allowed.
   */
  const canInvite = computed<boolean>(() => {
    // Nothing calls `agencyStore.$reset()` on logout, so after a user switch the
    // store still holds the previous viewer's agency until the re-fetch lands.
    // Requiring the latch to name the *current* auth user keeps the button off
    // during that window instead of offering someone else's agency.
    if (loadedForUserId.value !== authStore.user?.id) return false
    if (!store.isAgencyOwner) return false
    if (store.userAgency.agency?.status !== 'approved') return false

    const targetId = toValue(userId)
    if (!targetId || targetId === authStore.user?.id) return false

    return toValue(targetAgencyId) !== store.userAgency.agency.id
  })

  // ========================================
  // EXECUTE
  // ========================================

  /**
   * Load the agency context if this session has not yet resolved it.
   * Without it `isAgencyOwner` is false and the button never appears — the
   * profile page does not fetch agency context of its own accord.
   */
  async function ensureAgencyContext(): Promise<void> {
    const authUserId = authStore.user?.id ?? null

    if (authUserId === null) return
    if (loadedForUserId.value === authUserId) return
    if (store.userAgency.loading) return

    await fetchUserAgency()

    // Only latch on success, so a transient failure retries on the next mount.
    if (store.userAgency.error === null) {
      loadedForUserId.value = authUserId
    }
  }

  /**
   * Send the invitation. Errors (already invited, blocked, already a member)
   * surface as toasts from sendInvitation and resolve to `false` here.
   */
  async function invite(): Promise<boolean> {
    if (!canInvite.value || isSending.value || hasInvited.value) return false

    const targetId = toValue(userId)
    if (!targetId) return false

    isSending.value = true

    try {
      const invitation = await sendInvitation({ user_id: targetId })

      if (invitation === null) return false

      hasInvited.value = true
      return true
    } finally {
      isSending.value = false
    }
  }

  // ========================================
  // Return
  // ========================================

  return {
    canInvite,
    isSending,
    hasInvited,
    ensureAgencyContext,
    invite,
  }
}
