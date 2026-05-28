/**
 * Room Slide Store
 *
 * Holds the set of currently playing slide overlays. Slides are concurrent
 * (multiple users' slides render simultaneously) and self-removing on
 * SVGA completion — no queue, no combo, no current-item indirection.
 */
import { defineStore } from 'pinia';

export interface RoomSlideItem {
  id: string;
  assetUrl: string;
  userId: number;
  userName: string;
  timestamp: number;
}

export const useRoomSlideStore = defineStore('roomSlide', () => {
  const activeSlides = ref<RoomSlideItem[]>([]);

  function addSlide(item: Omit<RoomSlideItem, 'id' | 'timestamp'>) {
    activeSlides.value.push({
      ...item,
      id: `slide-${item.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    });
  }

  function removeSlide(id: string) {
    const i = activeSlides.value.findIndex((s) => s.id === id);
    if (i !== -1) activeSlides.value.splice(i, 1);
  }

  function clearSlides() {
    activeSlides.value = [];
  }

  return { activeSlides, addSlide, removeSlide, clearSlides };
});
