<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { PROP_TYPE_LABELS } from '~/types/prop'
import type { PropType as PropTypeEnum } from '~/types/prop'
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
    count: typeInfo.count,
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
 * Props for current tab.
 */
const currentProps = computed(() => mallStore.catalog.items)

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // Reset currentType to ensure fresh state on navigation
  mallStore.currentType = null
  
  // Fetch types first to populate tabs
  await mallStore.fetchTypes()

  // Set initial type to first available type after types are loaded
  const firstType = mallStore.orderedTypes[0]?.type ?? null
  mallStore.currentType = firstType

  // Now fetch catalog with correct type filter
  await mallStore.fetchCatalog({}, true)
})

// ========================================
// Handlers
// ========================================

async function handleTabChange(index: number): Promise<void> {
  const type = mallStore.orderedTypes[index]?.type ?? null
  await mallStore.setType(type as PropTypeEnum | null)
}

function handleSelectProp(prop: typeof mallStore.catalog.items[number]): void {
  mallStore.selectProp(prop)
}

async function handlePurchase(propId: number): Promise<void> {
  const success = await mallStore.purchaseProp(propId)
  if (success) {
    mallStore.selectProp(null)
  }
}

function handleCloseModal(): void {
  mallStore.selectProp(null)
}

async function handleLoadMore(): Promise<void> {
  if (mallStore.catalog.hasMore && !mallStore.catalog.loading) {
    await mallStore.fetchCatalog()
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
        :items="tabItems"
        variant="link"
        :ui="{
          trigger: 'min-w-fit mr-2 data-[state=active]:bg-secondary rounded-none inset-shadow-sm',
          list: 'overflow-x-scroll min-h-fit overflow-y-hidden',
        }"
        :content="false"
        @update:model-value="(val: any) => handleTabChange(tabItems.findIndex(t => t.value === val))"
      >
        <template #default="{ item }">
          <span>{{ item.label }}</span>
          <UBadge 
            v-if="item.count > 0" 
            color="neutral" 
            size="sm"
            variant="soft" 
            class="ml-1"
          >
            {{ item.count }}
          </UBadge>
        </template>
      </UTabs>

      <!-- Loading Skeleton for Props -->
      <div v-if="mallStore.catalog.loading && currentProps.length === 0" class="grid grid-cols-2 gap-2 mt-4">
        <USkeleton v-for="i in 6" :key="i" class="aspect-3/4 rounded-xl" />
      </div>

      <!-- Error State -->
      <div v-else-if="mallStore.catalog.error" class="mt-8 text-center">
        <icon name="i-lucide-alert-circle" class="size-12 text-error mx-auto mb-2" />
        <p class="text-muted">{{ mallStore.catalog.error }}</p>
        <UButton 
          color="primary" 
          variant="soft" 
          size="sm" 
          class="mt-4"
          @click="mallStore.fetchCatalog({}, true)"
        >
          Try Again
        </UButton>
      </div>

      <!-- Empty State -->
      <div v-else-if="currentProps.length === 0" class="mt-8 text-center py-8">
        <icon name="i-lucide-package" class="size-12 text-muted mx-auto mb-2" />
        <p class="text-muted">No props available in this category</p>
      </div>

      <!-- Props Grid -->
      <div v-else class="grid grid-cols-2 gap-2 mt-4">
        <MallPropCard
          v-for="prop in currentProps"
          :key="prop.id"
          :prop="prop"
          @select="handleSelectProp"
        />
      </div>

      <!-- Load More -->
      <div v-if="mallStore.catalog.hasMore && currentProps.length > 0" class="mt-4 text-center">
        <UButton
          color="neutral"
          variant="soft"
          :loading="mallStore.catalog.loading"
          @click="handleLoadMore"
        >
          Load More
        </UButton>
      </div>
    </div>

    <!-- Detail Modal -->
    <MallPropDetailModal
      :prop="mallStore.selectedProp"
      :open="!!mallStore.selectedProp"
      :is-purchasing="mallStore.isPurchasing"
      @close="handleCloseModal"
      @purchase="handlePurchase"
    />
  </main>
</template>

<style scoped>

</style>