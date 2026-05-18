// ========================================
// Following Data Composable
// ========================================
// Role: Data/Query — fetches ranked following list for home page carousel.
// No store needed — data flows via useAsyncData → props.

/**
 * Slim type matching FollowingCardResource (4 fields only).
 */
export interface FollowingCard {
  id: number
  name: string
  avatar: string | null
  frame_id: number | null
  signature: string
}

/**
 * Data composable for the ranked following carousel.
 *
 * Provides a single fetch function that returns the authenticated
 * user's followed users ranked by wealth_xp + charm_xp + followers_count.
 */
export function useFollowingData() {
  const { api } = useApi()

  /**
   * Fetch ranked following list from the Redis-cached endpoint.
   * Returns up to 30 users sorted by composite rank score.
   */
  async function fetchRankedFollowing(): Promise<FollowingCard[]> {
    const res = await api<{ data: FollowingCard[] }>('/me/following/ranked')
    return res.data ?? []
  }

  return { fetchRankedFollowing }
}
