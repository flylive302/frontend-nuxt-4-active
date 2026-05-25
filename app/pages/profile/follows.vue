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
const { fetchPage, normalizeError } = useFollowsList()
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
  get: () => route.query.tab === 'following' ? 'following' : 'followers',
  set: (val: string) => {
    router.replace({
      query: { ...route.query, tab: val },
    })
  },
})

const TAB_ITEMS = [
  { label: 'Followers', icon: 'i-lucide-users', value: 'followers' },
  { label: 'Following', icon: 'i-lucide-user-check', value: 'following' },
]

// ── Followers state ──
const followers = ref<MinimalUser[]>([])
const followersLoading = ref(false)
const followersNextCursor = ref<string | null>(null)
const followersInitialized = ref(false)

// ── Following state ──
const following = ref<MinimalUser[]>([])
const followingLoading = ref(false)
const followingNextCursor = ref<string | null>(null)
const followingInitialized = ref(false)

// ── Shared Page state ──
const isAccessRestricted = ref(false)

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
    isAccessRestricted.value = false
  }

  try {
    const { data, nextCursor } = await fetchPage('followers', targetUserId.value, followersNextCursor.value)

    followers.value.push(...data)
    followersNextCursor.value = nextCursor
    followersInitialized.value = true
  }
  catch (err: unknown) {
    const normalized = normalizeError(err)
    if (normalized.status === 403) {
      isAccessRestricted.value = true
    }
    else {
      toast.add({ title: 'Failed to load followers', description: normalized.message, color: 'error' })
    }
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
    isAccessRestricted.value = false
  }

  try {
    const { data, nextCursor } = await fetchPage('following', targetUserId.value, followingNextCursor.value)

    following.value.push(...data)
    followingNextCursor.value = nextCursor
    followingInitialized.value = true
  }
  catch (err: unknown) {
    const normalized = normalizeError(err)
    if (normalized.status === 403) {
      isAccessRestricted.value = true
    }
    else {
      toast.add({ title: 'Failed to load following', description: normalized.message, color: 'error' })
    }
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
      <!-- ═══ Restricted Access State ═══ -->
      <div v-if="isAccessRestricted" class="flex flex-col items-center justify-center py-24 text-center">
        <div class="size-24 rounded-full bg-muted/20 flex items-center justify-center mb-6">
          <Icon name="i-lucide-lock-keyhole" class="size-12 text-muted" />
        </div>
        <h3 class="text-xl font-bold mb-2">Restricted Access</h3>
        <p class="text-muted max-w-xs mx-auto mb-6">
          This user's follow list is private. You don't have permission to view their followers or following list.
        </p>
        <UButton
          to="/"
          variant="ghost"
          icon="i-lucide-arrow-left"
        >
          Go Back Home
        </UButton>
      </div>

      <!-- ═══ Normal State (Tabs & Content) ═══ -->
      <template v-else>
        <UTabs
          v-model="activeTab"
          :items="TAB_ITEMS"
          variant="link"
          class="w-full"
        />

        <!-- ═══ Tab Content (Rendered outside UTabs for Nuxt UI 4 compatibility) ═══ -->
        <div class="mt-4">
          <!-- Followers Tab Content -->
          <div v-if="activeTab === 'followers'">
            <!-- Loading State -->
            <div v-if="followersLoading && followers.length === 0" class="space-y-3">
              <div v-for="i in 6" :key="i" class="animate-pulse flex gap-3 p-3 bg-elevated rounded-lg">
                <div class="size-12 bg-muted rounded-full shrink-0" />
                <div class="flex-1 space-y-2 py-2">
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
          </div>

          <!-- Following Tab Content -->
          <div v-else-if="activeTab === 'following'">
            <!-- Loading State -->
            <div v-if="followingLoading && following.length === 0" class="space-y-3">
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
          </div>
        </div>
      </template>
    </div>
  </main>
</template>
