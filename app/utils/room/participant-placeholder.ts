import type { RoomParticipant } from '~/types/room/audio'

/** Minimal participant when MSAB seat update arrives before userJoined. */
export function createParticipantPlaceholder(userId: number): RoomParticipant {
  return {
    id: userId,
    name: `User ${userId}`,
    signature: '',
    avatar: '',
    frame: '',
    cover_image: null,
    gender: null,
    country: '',
    phone: '',
    email: null,
    date_of_birth: '',
    wealth_xp: '0',
    charm_xp: '0',
    vip_level: 0,
    isSpeaker: true,
  }
}
