import { defineStore } from 'pinia';
import { ref } from "vue";

export const useRoomStore = defineStore('roomStore', () => {
    const roomMinimized = ref(false);
    function minimizeRoom() { roomMinimized.value = false }
    function maximizeRoom() { roomMinimized.value = true }

    const activeSeat = ref<number | null>(null);
    function openSeat(seatId: number) { activeSeat.value = seatId }
    function closeSeat() { activeSeat.value = null }

    return {
        roomMinimized,
        minimizeRoom,
        maximizeRoom,
        activeSeat,
        openSeat,
        closeSeat
    }
});