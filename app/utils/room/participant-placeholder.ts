import type { RoomParticipant } from '~/types/room/audio'

/** Minimal participant when MSAB seat update arrives before userJoined. */
export function createParticipantPlaceholder(userId: number): RoomParticipant {
  return {
    id: userId,
    name: `User ${userId}`,
    signature: '',
    avatar: '',
    frame_id: null,
    chat_bubble_id: null,
    entry_animation_id: null,
    data_card_id: null,
    mice_wave_id: null,
    slides_id: null,
    cover_image: null,
    gender: null,
    country: '',
    date_of_birth: null,
    wealth_xp: '0',
    charm_xp: '0',
    vip_level: 0,
    // @ts-expect-error TODO Issue-06
    isSpeaker: true,
  }
}
