import { defineStore } from 'pinia'
import type {
  FloatingMultiplier,
  LuckyRoomAnnouncement,
  LuckyAppAnnouncement,
} from '~/types/lucky'

export const useLuckySessionStore = defineStore('luckySessionStore', () => {
  // ========================================
  // State
  // ========================================

  const floatingMultipliers = ref<FloatingMultiplier[]>([])
  const roomAnnouncement = ref<LuckyRoomAnnouncement | null>(null)
  const isRoomAnnouncementVisible = ref(false)
  const appAnnouncement = ref<LuckyAppAnnouncement | null>(null)
  const isAppAnnouncementVisible = ref(false)

  // ========================================
  // Setters
  // ========================================

  function addFloater(entry: FloatingMultiplier): void {
    floatingMultipliers.value.push(entry)
  }

  function removeFloater(id: number): void {
    floatingMultipliers.value = floatingMultipliers.value.filter((f) => f.id !== id)
  }

  function setRoomAnnouncement(data: LuckyRoomAnnouncement): void {
    roomAnnouncement.value = data
    isRoomAnnouncementVisible.value = true
  }

  function clearRoomAnnouncement(): void {
    isRoomAnnouncementVisible.value = false
    roomAnnouncement.value = null
  }

  function setAppAnnouncement(data: LuckyAppAnnouncement): void {
    appAnnouncement.value = data
    isAppAnnouncementVisible.value = true
  }

  function clearAppAnnouncement(): void {
    isAppAnnouncementVisible.value = false
    appAnnouncement.value = null
  }

  // ========================================
  // Reset
  // ========================================

  function $reset(): void {
    floatingMultipliers.value = []
    roomAnnouncement.value = null
    isRoomAnnouncementVisible.value = false
    appAnnouncement.value = null
    isAppAnnouncementVisible.value = false
  }

  // ========================================
  // Return
  // ========================================

  return {
    floatingMultipliers,
    roomAnnouncement,
    isRoomAnnouncementVisible,
    appAnnouncement,
    isAppAnnouncementVisible,
    addFloater,
    removeFloater,
    setRoomAnnouncement,
    clearRoomAnnouncement,
    setAppAnnouncement,
    clearAppAnnouncement,
    $reset,
  }
})
