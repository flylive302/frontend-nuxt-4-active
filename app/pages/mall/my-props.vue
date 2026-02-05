<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { PROP_TYPE_LABELS } from '~/types/prop'
import type { PropType as PropTypeEnum, UserProp } from '~/types/prop'
import {useAuthStore} from "~/stores/auth";

// ========================================
// Page Meta
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Store
// ========================================

const mallStore = useMallStore();
const authStore = useAuthStore();

// ========================================
// Computed
// ========================================

/**
 * Tab items from prop types.
 */
const tabItems = computed(() => {
  return mallStore.orderedTypes.map(typeInfo => ({
    label: PROP_TYPE_LABELS[typeInfo.type],
    value: typeInfo.type,
  }))
})

/**
 * Selected tab value synced with store.
 */
const selectedTab = computed({
  get: () => mallStore.currentType ?? tabItems.value[0]?.value ?? null,
  set: (val) => { mallStore.currentType = val as typeof mallStore.currentType },
})

/**
 * User props from store (already filtered by API).
 */
const currentUserProps = computed(() => mallStore.userProps.items)

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Reset currentType to ensure fresh state on navigation
  mallStore.currentType = null
  
  // Fetch types first, then set initial type before fetching user props
  await mallStore.fetchTypes()
  
  // Set initial type to first available type after types are loaded
  const firstType = mallStore.orderedTypes[0]?.type ?? null
  mallStore.currentType = firstType
  
  // Now fetch user props and equipped with correct type filter
  await Promise.all([
    mallStore.fetchUserProps({}, true),
    mallStore.fetchEquipped(),
  ])
})

// ========================================
// Handlers
// ========================================

async function handleTabChange(index: number): Promise<void> {
  const type = mallStore.orderedTypes[index]?.type ?? null
  mallStore.currentType = type as PropTypeEnum | null
  // Refetch with new type filter for server-side filtering
  await mallStore.fetchUserProps({}, true)
}

async function handleEquip(userPropId: number): Promise<void> {
  await mallStore.equipProp(userPropId)
}

async function handleUnequip(userPropId: number): Promise<void> {
  await mallStore.unequipProp(userPropId)
}

function handleSelectUserProp(_userProp: UserProp): void {
  // Could open a detail view in the future
}

async function handleLoadMore(): Promise<void> {
  if (mallStore.userProps.hasMore && !mallStore.userProps.loading) {
    await mallStore.fetchUserProps()
  }
}
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/mall/" second-link="/mall/my-props">
      <template #first-link-text>Props</template>
      <template #second-link-text>My Props</template>
    </NavAlt>

    <AltHero class="z-10" image-src="/siteAssets/alt-hero/secondary.webp">
      <div class="p-2 bg-linear-to-br to-secondary/30">
        <UserAvatar :animated="true" :frame-name="authStore?.user?.frame ?? undefined" :img="authStore?.user?.avatar ?? undefined" class="max-w-[40vw] mx-auto" />
      </div>
    </AltHero>

    <div class="px-3 mb-32 overflow-hidden">
      <!-- Loading Skeleton for Tabs -->
      <div v-if="mallStore.typesLoading" class="mt-6 flex gap-2">
        <USkeleton v-for="i in 4" :key="i" class="h-8 w-20 rounded-full" />
      </div>

      <!-- Tabs -->
      <UTabs
        v-else-if="tabItems.length > 0"
        v-model="selectedTab"
        color="neutral"
        size="sm"
        class="mt-2"
        variant="link"
        :items="tabItems"
        :ui="{
          trigger: 'min-w-fit mr-2 data-[state=active]:bg-secondary rounded-none inset-shadow-sm',
          list: 'overflow-x-scroll min-h-fit overflow-y-hidden',
        }"
        :content="false"
        @update:model-value="(val: any) => handleTabChange(tabItems.findIndex(t => t.value === val))"
      />

      <!-- Loading Skeleton for Props -->
      <div v-if="mallStore.userProps.loading && currentUserProps.length === 0" class="grid grid-cols-3 gap-2 mt-4">
        <USkeleton v-for="i in 6" :key="i" class="aspect-3/4 rounded-xl" />
      </div>

      <!-- Error State -->
      <div v-else-if="mallStore.userProps.error" class="mt-8 text-center">
        <icon name="i-lucide-alert-circle" class="size-12 text-error mx-auto mb-2" />
        <p class="text-muted">{{ mallStore.userProps.error }}</p>
        <UButton 
          color="primary" 
          variant="soft" 
          size="sm" 
          class="mt-4"
          @click="mallStore.fetchUserProps({}, true)"
        >
          Try Again
        </UButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="currentUserProps.length === 0" class="mt-8 text-center py-8">
        <icon name="i-lucide-package-open" class="size-12 text-muted mx-auto mb-2" />
        <p class="text-muted mb-4">You don't have any props yet</p>
        <UButton 
          color="primary" 
          variant="soft" 
          to="/mall/"
        >
          Browse Props
        </UButton>
      </div>

      <!-- Props Grid -->
      <div v-else class="grid grid-cols-3 gap-2 mt-4">
        <MallMyPropCard
          v-for="userProp in currentUserProps"
          :key="userProp.id"
          :user-prop="userProp"
          :is-equipping="mallStore.isEquipping === userProp.id"
          @equip="handleEquip"
          @unequip="handleUnequip"
          @select="handleSelectUserProp"
        />
      </div>

      <!-- Load More -->
      <div v-if="mallStore.userProps.hasMore && currentUserProps.length > 0" class="mt-4 text-center">
        <UButton
          color="neutral"
          variant="soft"
          :loading="mallStore.userProps.loading"
          @click="handleLoadMore"
        >
          Load More
        </UButton>
      </div>
    </div>
  </main>
</template>

<style scoped>

</style>