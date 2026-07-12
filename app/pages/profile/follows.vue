<script setup lang="ts">
// ========================================
// Follows Page — Followers / Following / Viewers Tabs
// ========================================

import type { MinimalUser, VisitorUser } from '~/types/user/bootstrap'
import { formatVisitTime } from '~/utils/date'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Dependencies
// ========================================

const route = useRoute()
const router = useRouter()
const { fetchPage: fetchFollowsPage, normalizeError: normalizeFollowsError } = useFollowsList()
const { fetchPage: fetchVisitorsPage, normalizeError: normalizeVisitorsError } = useVisitorsList()
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

function resolveTab(tab: unknown): string {
  if (tab === 'following') return 'following'
  if (tab === 'viewers' && isOwnProfile.value) return 'viewers'
  return 'followers'
}

const activeTab = ref<string>(resolveTab(route.query.tab))

// Sync local tab state to URL after DOM update to avoid Reka UI Presence crash
watch(activeTab, (val) => {
  router.replace({ query: { ...route.query, tab: val } })
}, { flush: 'post' })

// Sync from URL when navigating externally (back/forward, deep link)
watch(() => route.query.tab, (tab) => {
  const resolved = resolveTab(tab)
  if (activeTab.value !== resolved) activeTab.value = resolved
})

const TAB_ITEMS = computed(() => {
  const items = [
    { label: 'Followers', icon: 'i-lucide-users', value: 'followers' },
    { label: 'Following', icon: 'i-lucide-user-check', value: 'following' },
  ]
  if (isOwnProfile.value) {
    items.push({ label: 'Viewers', icon: 'i-lucide-eye', value: 'viewers' })
  }
  return items
})

// ── Per-tab cursor lists ──
const followers = useCursorUserList<MinimalUser>(
  cursor => fetchFollowsPage('followers', targetUserId.value!, cursor),
  normalizeFollowsError,
)

const following = useCursorUserList<MinimalUser>(
  cursor => fetchFollowsPage('following', targetUserId.value!, cursor),
  normalizeFollowsError,
)

const viewers = useCursorUserList<VisitorUser>(
  cursor => fetchVisitorsPage(cursor),
  normalizeVisitorsError,
)

// Access is restricted if either follow list rejects (403); viewers is
// self-only and never restricted.
const isAccessRestricted = computed(() => followers.accessRestricted.value || following.accessRestricted.value)

// ========================================
// Load orchestration
// ========================================

function loadAll(reset = true): void {
  if (targetUserId.value) {
    void followers.load(reset, message => toast.add({ title: 'Failed to load followers', description: message, color: 'error' }))
    void following.load(reset, message => toast.add({ title: 'Failed to load following', description: message, color: 'error' }))
  }
  if (isOwnProfile.value) {
    void viewers.load(reset, message => toast.add({ title: 'Failed to load viewers', description: message, color: 'error' }))
  }
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => loadAll(true))
onActivated(() => loadAll(true))
watch(targetUserId, () => loadAll(true))

// ========================================
// Helpers
// ========================================

function visitLabel(count: number): string {
  return `×${count} visit${count === 1 ? '' : 's'}`
}
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
            <div v-if="followers.loading.value && followers.items.value.length === 0" class="space-y-3">
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
              v-else-if="!followers.loading.value && followers.items.value.length === 0"
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
            <div v-else :ref="followers.containerRef" class="space-y-1">
              <UserFollowListItem
                v-for="user in followers.items.value"
                :key="user.id"
                :user="user"
              />

              <!-- Load More Spinner -->
              <div v-if="followers.loading.value" class="py-4 text-center">
                <UButton loading variant="ghost" disabled>Loading more...</UButton>
              </div>

              <!-- End of List -->
              <div
                v-else-if="!followers.nextCursor.value && followers.items.value.length > 0"
                class="py-4 text-center text-muted text-sm"
              >
                That's everyone
              </div>
            </div>
          </div>

          <!-- Following Tab Content -->
          <div v-else-if="activeTab === 'following'">
            <!-- Loading State -->
            <div v-if="following.loading.value && following.items.value.length === 0" class="space-y-3">
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
              v-else-if="!following.loading.value && following.items.value.length === 0"
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
            <div v-else :ref="following.containerRef" class="space-y-1">
              <UserFollowListItem
                v-for="user in following.items.value"
                :key="user.id"
                :user="user"
              />

              <!-- Load More Spinner -->
              <div v-if="following.loading.value" class="py-4 text-center">
                <UButton loading variant="ghost" disabled>Loading more...</UButton>
              </div>

              <!-- End of List -->
              <div
                v-else-if="!following.nextCursor.value && following.items.value.length > 0"
                class="py-4 text-center text-muted text-sm"
              >
                That's everyone
              </div>
            </div>
          </div>

          <!-- Viewers Tab Content (own profile only) -->
          <div v-else-if="activeTab === 'viewers' && isOwnProfile">
            <!-- Loading State -->
            <div v-if="viewers.loading.value && viewers.items.value.length === 0" class="space-y-3">
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
              v-else-if="!viewers.loading.value && viewers.items.value.length === 0"
              class="flex flex-col items-center justify-center py-16 text-center"
            >
              <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Icon name="i-lucide-eye" class="size-10 text-primary" />
              </div>
              <h3 class="text-lg font-semibold mb-1">No Visitors Yet</h3>
              <p class="text-sm text-muted max-w-xs">
                When someone views your profile, they'll appear here.
              </p>
            </div>

            <!-- Viewers List -->
            <div v-else :ref="viewers.containerRef" class="space-y-1">
              <div v-for="visitor in viewers.items.value" :key="visitor.id" class="px-2 py-1">
                <MinimalUserList :user="visitor">
                  <template #default>
                    <div class="flex flex-col items-end justify-center pr-3 gap-0.5">
                      <span class="text-xs text-muted whitespace-nowrap">{{ formatVisitTime(visitor.last_visited_at) }}</span>
                      <span class="text-[11px] text-muted/70 whitespace-nowrap">{{ visitLabel(visitor.visit_count) }}</span>
                    </div>
                  </template>
                </MinimalUserList>
              </div>

              <!-- Load More Spinner -->
              <div v-if="viewers.loading.value" class="py-4 text-center">
                <UButton loading variant="ghost" disabled>Loading more...</UButton>
              </div>

              <!-- End of List -->
              <div
                v-else-if="!viewers.nextCursor.value && viewers.items.value.length > 0"
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
