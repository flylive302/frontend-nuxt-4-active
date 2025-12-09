import type { User } from './auth';

export interface Logo {
    large: string
    medium: string
    original: string
    thumbnail: string
}

export interface Room {
  id: number;
  name: string;
  logo: Logo;
  type: 'public' | 'private';
  country: string;
  is_live: boolean;
  participant_count: number;
  last_activity_at: string | null;
  user: User;
  created_at: string;
}

export interface CreateRoomPayload {
  name: string;
  country: string;
  type: 'public' | 'private';
  password?: string;
  logo?: File;
}

export interface RoomResponse {
    status: string;
    message: string;
    data: Room;
}

export interface RoomsResponse {
  status: string;
  message: string;
  data: Room[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  }
}
