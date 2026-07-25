// ========================================
// Seat Drawer Action Eligibility
// ========================================
//
// Role: Data/derived. The seat drawer opens in two modes — seat management
// (a seat slot was tapped) and view-only profile (an avatar was tapped in
// chat). Which *per-user* actions are offered depends on the TARGET USER's
// state, never on which mode opened the drawer, so all of that gating lives
// here and `seat-drawer.vue` stays INTENT-only.
//
// Seat-*slot* actions (take / leave / lock / mute / invite-to-this-seat) are
// not modelled here — they act on a slot, and profile mode has no slot.
// ========================================

// ========================================
// Types
// ========================================

export interface SeatDrawerActionState {
  /** User shown on the card, or null (empty seat / participant already gone). */
  targetUserId: number | null
  /** Authenticated user's id. */
  selfUserId: number | null
  /** Target is still a live participant of this room. */
  isTargetInRoom: boolean
  /** Target currently occupies a seat. */
  isTargetSeated: boolean
  /** Viewer is room owner or an admin member. */
  canManageMembers: boolean
  /** First empty, unlocked seat an invited user could be placed on. */
  freeSeatIndex: number | null
}

export interface SeatDrawerActions {
  isSelf: boolean
  canFollow: boolean
  canChat: boolean
  canGift: boolean
  canMute: boolean
  canKick: boolean
  canInviteToSeat: boolean
}

// ========================================
// Pure Helper (unit-testable without Nuxt runtime)
// ========================================

/**
 * Resolve which per-user actions the drawer may offer.
 *
 * Each flag encodes the *real* precondition of the action it guards, so an
 * offered button is always one that can actually complete:
 *
 * - follow / chat  — reach any user; need neither a seat nor room presence.
 * - gift           — `useGiftEligibility` resolves recipients from occupied
 *                    seats, so a non-seated recipient opens the gift drawer
 *                    with an empty recipient list. Seated targets only.
 * - mute           — silences a live producer, which only a seated user has.
 * - kick           — kick IS a room block (ADR 0017): it needs the target to
 *                    be present in the room, seated or not. Gone → no button.
 * - invite to seat — only meaningful for someone present but not speaking,
 *                    and only when a free unlocked seat exists to invite onto.
 */
export function resolveSeatDrawerActions(state: SeatDrawerActionState): SeatDrawerActions {
  const { targetUserId, selfUserId, isTargetInRoom, isTargetSeated, canManageMembers, freeSeatIndex } = state

  const isSelf = targetUserId !== null && targetUserId === selfUserId
  // Every action below targets someone else; a null target has nothing to act on.
  const isOther = targetUserId !== null && !isSelf
  const canModerate = isOther && canManageMembers && isTargetInRoom

  return {
    isSelf,
    canFollow: isOther,
    canChat: isOther,
    canGift: isOther && isTargetSeated,
    canMute: canModerate && isTargetSeated,
    canKick: canModerate,
    canInviteToSeat: canModerate && !isTargetSeated && freeSeatIndex !== null,
  }
}

// ========================================
// Composable
// ========================================

/**
 * Reactive action eligibility for the drawer's current target user.
 *
 * @param targetUserId - Reactive getter for the displayed user's id (null when
 *                       the seat is empty or the participant has left).
 */
export function useSeatDrawerActions(targetUserId: MaybeRefOrGetter<number | null>) {
  const authStore = useAuthStore()
  const seatsStore = useRoomSeatsStore()
  const participantsStore = useRoomParticipantsStore()
  const { isRoomOwner } = useRoomPermissions()
  const { myMembership } = useRoomMembers()

  /** Owner always moderates; admin members do too. */
  const canManageMembers = computed(() => isRoomOwner.value || myMembership.value?.role === 'admin')

  /** Lowest empty, unlocked seat — the slot an invite would target. */
  const freeSeatIndex = computed<number | null>(() => {
    const seat = seatsStore.seatsWithUsers.find((s) => !s.user && !s.isLocked)
    return seat?.index ?? null
  })

  const isTargetInRoom = computed(() => {
    const id = toValue(targetUserId)
    return id !== null && participantsStore.participants.has(id)
  })

  const isTargetSeated = computed(() => {
    const id = toValue(targetUserId)
    return id !== null && seatsStore.speakerIds.has(id)
  })

  const actions = computed(() =>
    resolveSeatDrawerActions({
      targetUserId: toValue(targetUserId),
      selfUserId: authStore.user?.id ?? null,
      isTargetInRoom: isTargetInRoom.value,
      isTargetSeated: isTargetSeated.value,
      canManageMembers: canManageMembers.value,
      freeSeatIndex: freeSeatIndex.value,
    }),
  )

  return {
    canManageMembers,
    freeSeatIndex,
    isTargetInRoom,
    isTargetSeated,
    isSelfTarget: computed(() => actions.value.isSelf),
    canFollow: computed(() => actions.value.canFollow),
    canChat: computed(() => actions.value.canChat),
    canGift: computed(() => actions.value.canGift),
    canMute: computed(() => actions.value.canMute),
    canKick: computed(() => actions.value.canKick),
    canInviteToSeat: computed(() => actions.value.canInviteToSeat),
  }
}
