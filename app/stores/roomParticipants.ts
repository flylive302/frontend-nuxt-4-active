import { defineStore } from 'pinia';
import type { RoomParticipant } from '~/types/room/audio';

export const useRoomParticipantsStore = defineStore('roomParticipants', () => {
  const participants = ref<Map<number, RoomParticipant>>(new Map())
  const participantList = computed(() => Array.from(participants.value.values()))

  function addParticipant(user: RoomParticipant): void {
    participants.value.set(user.id, user)
  }

  function removeParticipant(userId: number): void {
    participants.value.delete(userId)
  }

  /**
   * Reconcile the participant set against an authoritative join snapshot.
   *
   * The join response is the source of truth: anyone present is upserted,
   * anyone absent is pruned. Without this the Map only ever grows (every
   * re-join MERGES the snapshot onto stale state), so a participant who left
   * while we were disconnected lingers forever and the displayed count drifts.
   *
   * Upsert/prune is done-issues in place (not a wholesale Map replace) to preserve
   * object identity for unchanged participants — avoids list re-render churn.
   * `keepSelfId` shields the local user, who is added separately by joinRoom
   * and never appears in the snapshot's `participants` array.
   */
  function reconcileParticipants(snapshot: RoomParticipant[], keepSelfId?: number): void {
    const keep = new Set(snapshot.map((p) => p.id))
    if (keepSelfId != null) keep.add(keepSelfId)

    for (const id of [...participants.value.keys()]) {
      if (!keep.has(id)) participants.value.delete(id)
    }

    for (const p of snapshot) {
      const existing = participants.value.get(p.id)
      if (existing) Object.assign(existing, p)
      else participants.value.set(p.id, p)
    }
  }

  function updateParticipantProfile(userId: number, profile: Partial<RoomParticipant>): void {
    const participant = participants.value.get(userId)
    if (!participant) return
    Object.assign(participant, profile)
  }

  function clear(): void {
    participants.value.clear()
  }

  return { participants, participantList, addParticipant, removeParticipant, reconcileParticipants, updateParticipantProfile, clear }
})
