// ========================================
// Mission Store
// ========================================
// State + setters ONLY. API calls live in useRechargeMissionData.
// ========================================

import { defineStore } from 'pinia'
import type { MissionProgressResponse } from '~/types/mission/recharge'

export const useMissionStore = defineStore('mission', () => {
  // ========================================
  // State
  // ========================================

  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const dailyProgress = ref<MissionProgressResponse | null>(null)

  // ========================================
  // Setters
  // ========================================

  function setLoading(value: boolean): void {
    isLoading.value = value
  }

  function setError(message: string | null): void {
    error.value = message
  }

  function setDailyProgress(data: MissionProgressResponse): void {
    dailyProgress.value = data
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    dailyProgress: readonly(dailyProgress),
    setLoading,
    setError,
    setDailyProgress,
  }
})
