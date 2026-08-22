import type { CreateRoomPayload, RoomResponse, RoomsResponse } from "~/types/room/room";

export function useRoom() {
    // ========================================
    // Composables / Injected Dependencies
    // ========================================
    const { api, fetchCsrfToken } = useApi()
    const roomStore = useRoomStore();
    const roomSessionStore = useRoomSessionStore();
    const roomSession = useRoomSession();
    const toast = useToast()

    // ========================================
    // Business Logic
    // ========================================

    /**
     * Fetch the authenticated user's room.
     * Updates the store with the result.
     */
    async function fetchUserRoom(): Promise<void> {
        roomStore.updateStatus('loading');

        try {
            const response = await api<RoomResponse>('/rooms/myRoom', {
                method: 'GET',
            })

            if (response.status === 'success') {
                roomSessionStore.setUserRoom(response.data);
                roomStore.updateStatus('idle');
            } else {
                toast.add({ title: response.message, color: 'error' })
                roomStore.updateStatus('error');
            }
        } catch (error: unknown) {
            const errorMessage = (error as { data?: { message?: string } })?.data?.message || 'Failed to fetch room'
            toast.add({ title: errorMessage, color: 'error' })
            roomStore.updateStatus('error');
        }
    }
    /**
     * Create a new room.
     * @param payload - The room creation data (use logo_url and logo_file_id for pre-uploaded logos).
     * @returns The created room data.
     * @throws ApiError if creation fails.
     */
    async function createRoom(payload: CreateRoomPayload): Promise<RoomResponse> {
        await fetchCsrfToken();

        // Build JSON payload (no FormData - logos are pre-uploaded to ImageKit)
        const body: Record<string, unknown> = {
            name: payload.name,
            country: payload.country,
            type: payload.type,
        };

        if (payload.password) {
            body.password = payload.password;
        }

        // Use pre-uploaded logo URL if available
        if (payload.logo_url && payload.logo_file_id) {
            body.logo_url = payload.logo_url;
            body.logo_file_id = payload.logo_file_id;
        }

        // We want to propagate errors to the component for proper form handling
        const response = await api<RoomResponse>('/rooms', {
            method: 'POST',
            body,
        });

        if (response.status === "success") {
            roomSessionStore.setUserRoom(response.data);
            roomSession.setCurrentRoom(response.data);
            await navigateTo(`/room/${response.data.id}`);
            toast.add({ title: response.message, color: 'success' })
            return response;
        } else {
            // Even if api() doesn't throw (depending on implementation),
            // if success is false, we should probably treat it as an error or let component handle it.
            // However, usually api() throws on non-2xx. If it returns structured error with success=false, process here.
            
            // For safety in this refactor, if we get here it means HTTP 200 OK but application logic failure?
            // Usually FlyLive API throws on errors. Assuming api composable handles throws.
            
            // If we do get a success: false payload without throw:
            throw createError({
                statusCode: 400,
                statusMessage: response.message,
                data: response
            })
        }
    }

    /**
     * Fetch a paginated list of rooms.
     * @param params - Query parameters (page, country).
     * @returns The API response containing rooms and metadata.
     */
    async function fetchRooms(params: { page?: number; country?: string } = {}): Promise<RoomsResponse> {
        return await api<RoomsResponse>('/rooms', {
            params,
        });
    }

    /**
     * Re-fetch a specific room's data from the API.
     * Used to refresh stale persisted `currentRoom` data on page refresh
     * or when returning from minimized state.
     * Silent failure — stale data is better than no data.
     */
    async function fetchRoomById(roomId: number): Promise<void> {
        try {
            const response = await api<RoomResponse>(`/rooms/${roomId}`, {
                method: 'GET',
            })

            if (response.status === 'success' && response.data) {
                // Only update if this is still the current room (user may have left)
                if (roomStore.currentRoom?.id === roomId) {
                    roomStore.refreshCurrentRoom(response.data)
                }
            }
        } catch {
            // Silent — persisted data is acceptable fallback
        }
    }

    return {
        fetchUserRoom,
        fetchRoomById,
        createRoom,
        fetchRooms
    }
}
