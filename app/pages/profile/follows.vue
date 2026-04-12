<script setup lang="ts">
// ========================================
// Follows Page — Followers & Following Tabs
// ========================================

import { useInfiniteScroll } from '@vueuse/core'
import { createLogger } from '~/utils/logger'
import type { MinimalUser } from '~/types/user/bootstrap'

const log = createLogger('[FollowsPage]')

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Dependencies
// ========================================

const route = useRoute()
const router = useRouter()
const { api, normalizeError } = useApi()
const authStore = useAuthStore()
const toast = useToast()

// ========================================
// State
// ========================================

const targetUserId = computed(() => {
  const q = route.query.user
  return q ? Number(q) : authStore.user?.id ?? null
})

const isOwnProfile = computed(() => targetUserId.value === authStore.user?.id)

const activeTab = computed({
  get: () => route.query.tab === 'following' ? 1 : 0,
  set: (index: number) => {
    router.replace({
      query: { ...route.query, tab: index === 1 ? 'following' : 'followers' },
    })
  },
})

const TAB_ITEMS = [
  { label: 'Followers', icon: 'i-lucide-users', slot: 'followers' as const },
  { label: 'Following', icon: 'i-lucide-user-check', slot: 'following' as const },
]

// ── Followers state ──
const followers = ref<MinimalUser[]>([])
const followersLoading = ref(false)
const followersNextCursor = ref<string | null>(null)
const followersPrivate = ref(false)
const followersInitialized = ref(false)

// ── Following state ──
const following = ref<MinimalUser[]>([])
const followingLoading = ref(false)
const followingNextCursor = ref<string | null>(null)
const followingPrivate = ref(false)
const followingInitialized = ref(false)

// ── Infinite scroll refs ──
const followersContainerRef = ref<HTMLElement | null>(null)
const followingContainerRef = ref<HTMLElement | null>(null)

// ========================================
// API Helpers
// ========================================

async function loadFollowers(reset = false): Promise<void> {
  if (followersLoading.value || (!reset && !followersNextCursor.value && followersInitialized.value)) return
  if (!targetUserId.value) return

  followersLoading.value = true
  if (reset) {
    followers.value = []
    followersNextCursor.value = null
    followersPrivate.value = false
  }

  try {
    const params = new URLSearchParams({ per_page: '20' })
    if (followersNextCursor.value) params.set('cursor', followersNextCursor.value)

    const response = await api<{
      status: string
      data: MinimalUser[]
      meta: { pagination: { next_cursor: string | null } }
    }>(`/users/${targetUserId.value}/followers?${params}`)

    followers.value.push(...response.data)
    followersNextCursor.value = response.meta?.pagination?.next_cursor ?? null
    followersInitialized.value = true
  }
  catch (err: unknown) {
    const normalized = normalizeError(err)
    if (normalized.status === 403) {
      followersPrivate.value = true
    }
    else {
      toast.add({ title: 'Failed to load followers', description: normalized.message, color: 'error' })
    }
    log.error('loadFollowers error:', err)
  }
  finally {
    followersLoading.value = false
  }
}

async function loadFollowing(reset = false): Promise<void> {
  if (followingLoading.value || (!reset && !followingNextCursor.value && followingInitialized.value)) return
  if (!targetUserId.value) return

  followingLoading.value = true
  if (reset) {
    following.value = []
    followingNextCursor.value = null
    followingPrivate.value = false
  }

  try {
    const params = new URLSearchParams({ per_page: '20' })
    if (followingNextCursor.value) params.set('cursor', followingNextCursor.value)

    const response = await api<{
      status: string
      data: MinimalUser[]
      meta: { pagination: { next_cursor: string | null } }
    }>(`/users/${targetUserId.value}/following?${params}`)

    following.value.push(...response.data)
    followingNextCursor.value = response.meta?.pagination?.next_cursor ?? null
    followingInitialized.value = true
  }
  catch (err: unknown) {
    const normalized = normalizeError(err)
    if (normalized.status === 403) {
      followingPrivate.value = true
    }
    else {
      toast.add({ title: 'Failed to load following', description: normalized.message, color: 'error' })
    }
    log.error('loadFollowing error:', err)
  }
  finally {
    followingLoading.value = false
  }
}

// ========================================
// Infinite Scroll
// ========================================

useInfiniteScroll(
  followersContainerRef,
  async () => {
    if (followersNextCursor.value && !followersLoading.value) await loadFollowers()
  },
  { distance: 200 },
)

useInfiniteScroll(
  followingContainerRef,
  async () => {
    if (followingNextCursor.value && !followingLoading.value) await loadFollowing()
  },
  { distance: 200 },
)

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  void loadFollowers(true)
  void loadFollowing(true)
})

watch(targetUserId, () => {
  void loadFollowers(true)
  void loadFollowing(true)
})
</script>

<template>
  <main>
    <NavAlt :back-to="isOwnProfile ? '/profile' : '/'">
      {{ isOwnProfile ? 'My Follows' : 'Follows' }}
    </NavAlt>

    <div class="px-3 pt-14 pb-24">
      <UTabs
        v-model="activeTab"
        :items="TAB_ITEMS"
        variant="link"
        class="w-full"
      >
        <!-- ═══ Followers Tab ═══ -->
        <template #followers>
          <!-- Private State -->
          <div v-if="followersPrivate" class="flex flex-col items-center justify-center py-16 text-center">
            <div class="size-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <Icon name="i-lucide-lock" class="size-10 text-muted" />
            </div>
            <h3 class="text-lg font-semibold mb-1">Private List</h3>
            <p class="text-sm text-muted max-w-xs">
              This user's follow list is private.
            </p>
          </div>

          <!-- Loading State -->
          <div v-else-if="followersLoading && followers.length === 0" class="space-y-3">
            <div v-for="i in 6" :key="i" class="animate-pulse flex gap-3 p-3 bg-elevated rounded-lg">
              <div class="size-12 bg-muted rounded-full shrink-0" />
              <div class="flex-1 space-y-2 py-1">
                <div class="h-4 bg-muted rounded w-3/4" />
                <div class="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="!followersLoading && followers.length === 0"
            class="flex flex-col items-center justify-center py-16 text-center"
          >
            <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Icon name="i-lucide-users" class="size-10 text-primary" />
            </div>
            <h3 class="text-lg font-semibold mb-1">No Followers Yet</h3>
            <p class="text-sm text-muted max-w-xs">
              {{ isOwnProfile ? 'When users follow you, they\'ll appear here.' : 'This user has no followers yet.' }}
            </p>
          </div>

          <!-- Followers List -->
          <div v-else ref="followersContainerRef" class="space-y-1">
            <UserFollowListItem
              v-for="user in followers"
              :key="user.id"
              :user="user"
            />

            <!-- Load More Spinner -->
            <div v-if="followersLoading" class="py-4 text-center">
              <UButton loading variant="ghost" disabled>Loading more...</UButton>
            </div>

            <!-- End of List -->
            <div
              v-else-if="!followersNextCursor && followers.length > 0"
              class="py-4 text-center text-muted text-sm"
            >
              That's everyone
            </div>
          </div>
        </template>

        <!-- ═══ Following Tab ═══ -->
        <template #following>
          <!-- Private State -->
          <div v-if="followingPrivate" class="flex flex-col items-center justify-center py-16 text-center">
            <div class="size-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
              <Icon name="i-lucide-lock" class="size-10 text-muted" />
            </div>
            <h3 class="text-lg font-semibold mb-1">Private List</h3>
            <p class="text-sm text-muted max-w-xs">
              This user's follow list is private.
            </p>
          </div>

          <!-- Loading State -->
          <div v-else-if="followingLoading && following.length === 0" class="space-y-3">
            <div v-for="i in 6" :key="i" class="animate-pulse flex gap-3 p-3 bg-elevated rounded-lg">
              <div class="size-12 bg-muted rounded-full shrink-0" />
              <div class="flex-1 space-y-2 py-1">
                <div class="h-4 bg-muted rounded w-3/4" />
                <div class="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>

          <!-- Empty State -->
          <div
            v-else-if="!followingLoading && following.length === 0"
            class="flex flex-col items-center justify-center py-16 text-center"
          >
            <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Icon name="i-lucide-user-check" class="size-10 text-primary" />
            </div>
            <h3 class="text-lg font-semibold mb-1">Not Following Anyone</h3>
            <p class="text-sm text-muted max-w-xs">
              {{ isOwnProfile ? 'Start following users to see them here.' : 'This user isn\'t following anyone yet.' }}
            </p>
          </div>

          <!-- Following List -->
          <div v-else ref="followingContainerRef" class="space-y-1">
            <UserFollowListItem
              v-for="user in following"
              :key="user.id"
              :user="user"
            />

            <!-- Load More Spinner -->
            <div v-if="followingLoading" class="py-4 text-center">
              <UButton loading variant="ghost" disabled>Loading more...</UButton>
            </div>

            <!-- End of List -->
            <div
              v-else-if="!followingNextCursor && following.length > 0"
              class="py-4 text-center text-muted text-sm"
            >
              That's everyone
            </div>
          </div>
        </template>
      </UTabs>
    </div>
  </main>
</template>
