import type { CreateRoomPayload, RoomResponse, RoomsResponse } from "~/types/room";

export function useRoom() {
    // ========================================
    // Composables / Injected Dependencies
    // ========================================
    const { api, fetchCsrfToken } = useApi()
    const roomStore = useRoomStore();
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
                roomStore.setUserRoom(response.data);
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
     * @returns 'success' if created, 'failed' otherwise.
     */
    async function createRoom(payload: CreateRoomPayload): Promise<'success' | 'failed'> {
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

        try {
            const response = await api<RoomResponse>('/rooms', {
                method: 'POST',
                body,
            });

            if (response.status === "success") {
                roomStore.setUserRoom(response.data);
                roomStore.setCurrentRoom(response.data);
                toast.add({ title: response.message, color: 'success' })
                return 'success';
            } else {
                roomStore.setUserRoom(null);
                toast.add({ title: response.message, color: "error" })
                return 'failed';
            }
        } catch (error: unknown) {
             const errorMessage = (error as { data?: { message?: string } })?.data?.message || 'Failed to create room'
             roomStore.setUserRoom(null);
             toast.add({ title: errorMessage, color: "error" })
             return 'failed';
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

    return {
        fetchUserRoom,
        createRoom,
        fetchRooms
    }
}
