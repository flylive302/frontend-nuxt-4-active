import { defineStore } from 'pinia';

// ========================================
// User Blocks Store
// ========================================
// Pure state: which user ids the current user has blocked (profile-level
// block, `/profile/blocks`). Ref + computed + setters ONLY — no API calls
// here. See `app/composables/user/useUserBlocking.ts` for the pipeline.
export const useUserBlocksStore = defineStore('userBlocksStore', () => {
  const blockedUserIds = ref<Set<number>>(new Set());

  function isBlocked(userId: number | null | undefined): boolean {
    if (userId === null || userId === undefined) return false;
    return blockedUserIds.value.has(userId);
  }

  /** Replace the full set (e.g. after a fresh GET /profile/blocks page-through). */
  function setBlocked(ids: number[]) {
    blockedUserIds.value = new Set(ids);
  }

  function addBlocked(userId: number) {
    blockedUserIds.value = new Set(blockedUserIds.value).add(userId);
  }

  function removeBlocked(userId: number) {
    const next = new Set(blockedUserIds.value);
    next.delete(userId);
    blockedUserIds.value = next;
  }

  return {
    blockedUserIds,
    isBlocked,
    setBlocked,
    addBlocked,
    removeBlocked,
  };
});
