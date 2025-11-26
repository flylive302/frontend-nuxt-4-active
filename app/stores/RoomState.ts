import { defineStore } from 'pinia';
import { ref } from "vue";

export const useRoomStore = defineStore('roomStore',() => {
    const roomMinimized= ref(false);
    function minimizeRoom() {roomMinimized.value = false}
    function maximizeRoom() {roomMinimized.value = true}

    return {
        roomMinimized,
        minimizeRoom,
        maximizeRoom
    }
});