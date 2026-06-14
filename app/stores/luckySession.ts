import { defineStore } from 'pinia'
import type { FloatingMultiplier } from '~/types/lucky'

export const useLuckySessionStore = defineStore('luckySessionStore', () => {
  // ========================================
  // State
  // ========================================

  const floatingMultipliers = ref<FloatingMultiplier[]>([])

  // ========================================
  // Setters
  // ========================================

  function addFloater(entry: FloatingMultiplier): void {
    floatingMultipliers.value.push(entry)
  }

  function removeFloater(id: number): void {
    floatingMultipliers.value = floatingMultipliers.value.filter((f) => f.id !== id)
  }

  // ========================================
  // Reset
  // ========================================

  function $reset(): void {
    floatingMultipliers.value = []
  }

  // ========================================
  // Return
  // ========================================

  return {
    floatingMultipliers,
    addFloater,
    removeFloater,
    $reset,
  }
})
