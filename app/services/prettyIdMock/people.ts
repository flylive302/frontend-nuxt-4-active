// ========================================
// Pretty ID mock backend — fictional people
// ========================================
//
// Everyone but "me". Ids are negative so they can never collide with a real
// profile id (which also means a rival's card cannot link to a real profile).

import { PRETTY_ID_MOCK_AVATAR_BASE, PRETTY_ID_MOCK_AVATAR_COUNT } from '~/constants/assets'
import type { MockUserRef } from '~/services/prettyIdMock/state'
import type { PrettyIdMockProfile, PrettyIdUserCard } from '~/types/pretty-id'

export interface MockPerson {
  id: number
  name: string
  /** Index into the placeholder avatar set (wrapped by `PRETTY_ID_MOCK_AVATAR_COUNT`). */
  avatar: number
}

export const STAR_99: MockPerson = { id: -1, name: 'Star_99', avatar: 1 }
export const KING_ALI: MockPerson = { id: -2, name: 'KingAli', avatar: 3 }
export const MIRA: MockPerson = { id: -3, name: 'Mira', avatar: 4 }
export const ZAYAN: MockPerson = { id: -4, name: 'Zayan', avatar: 5 }
export const LEO_R: MockPerson = { id: -5, name: 'Leo.R', avatar: 7 }
export const NOOR: MockPerson = { id: -6, name: 'Noor', avatar: 6 }
export const ARJUN: MockPerson = { id: -7, name: 'Arjun', avatar: 2 }

/** Bots that place rival bids, in the demo's roster order. */
export const MOCK_RIVALS: readonly MockPerson[] = [STAR_99, KING_ALI, MIRA, ZAYAN, LEO_R, NOOR, ARJUN]

/** Fictional user behind the seeded "Fly Live" rows — display only, never bids, never "me". */
export const FLY_LIVE: MockPerson = { id: -8, name: 'Fly Live', avatar: 0 }

/** The unseen user who takes an ID when the race lever is armed. */
export const MOCK_RACE_THIEF: MockPerson = { id: -9, name: 'Rival', avatar: 8 }

const ALL_PEOPLE: readonly MockPerson[] = [...MOCK_RIVALS, FLY_LIVE, MOCK_RACE_THIEF]

export function rivalAt(index: number): MockPerson {
  return MOCK_RIVALS[index % MOCK_RIVALS.length] ?? STAR_99
}

function avatarUrl(avatar: number): string {
  return `${PRETTY_ID_MOCK_AVATAR_BASE}/av${avatar % PRETTY_ID_MOCK_AVATAR_COUNT}.webp`
}

/** The display card for a stored user reference; "me" comes from the live profile. */
export function userCard(ref: MockUserRef, profile: PrettyIdMockProfile): PrettyIdUserCard {
  if (ref === 'me') return { id: profile.id, name: profile.name, avatar_url: profile.avatar_url }
  const person = ALL_PEOPLE.find(candidate => candidate.id === ref)
  if (!person) return { id: ref, name: 'Player', avatar_url: null }
  return { id: person.id, name: person.name, avatar_url: avatarUrl(person.avatar) }
}
