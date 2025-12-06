import { defineStore } from 'pinia';
import { ref } from "vue";
import type { Room } from '~/types/room';

type StatusType = 'idle' | 'loading' | 'error';
export const useRoomStore = defineStore('roomStore', () => {
    // Room State
    const currentRoom = ref<Room | null>(null);
    const userRoom = ref<Room | null>(null); // The room owned by the authenticated user
    const isMinimized = ref(false); // If true, show minimized view (if currentRoom exists)
    const status = ref<StatusType>('idle');

    // Actions
    function updateStatus( newStatus: StatusType){
        status.value = newStatus;
    }
    function minimizeRoom() {
        if (currentRoom.value) {
            isMinimized.value = true;
        }
    }

    function maximizeRoom() {
        if (currentRoom.value) {
            isMinimized.value = false;
        }
    }

    function setCurrentRoom(room: Room | null) {
        currentRoom.value = room;
        isMinimized.value = false; // Auto maximize on entry
    }

    function setUserRoom(room: Room | null) {
        userRoom.value = room;
    }

    function leaveRoom() {
        currentRoom.value = null;
        isMinimized.value = false;
    }



    // Existing activeSeat logic

    const activeSeat = ref<number | null>(null);
    function openSeat(seatId: number) { activeSeat.value = seatId }
    function closeSeat() { activeSeat.value = null }
    
    return {
        // State
        currentRoom,
        userRoom,
        isMinimized,
        status,
        
        // Actions
        minimizeRoom,
        maximizeRoom,
        updateStatus,
        setCurrentRoom,
        setUserRoom,
        leaveRoom,

        
        // Seat
        activeSeat,
        openSeat,
        closeSeat
    }
},{
    persist: {
        pick: ['userRoom', 'currentRoom'],
    }
});