<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
import { onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

// ========================================
// Page Meta
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Dependencies
// ========================================

const mallStore = useMallStore()
const authStore = useAuthStore()
const { purchaseProp, isPurchasing } = useMallActions()
const { resolvePropAsset } = usePropLookup()
const {
  tabItems,
  selectedTab,
  initializeCatalog,
  handleCatalogTabChange,
  selectProp,
  loadMoreCatalog,
  fetchCatalog,
} = useMallPage()

// ========================================
// Computed
// ========================================

/** Props for current tab. */
const currentProps = computed(() => mallStore.catalog.items)

// ========================================
// Lifecycle
// ========================================

onMounted(() => initializeCatalog())

// ========================================
// Handlers (INTENT — delegate to composables)
// ========================================

async function handlePurchase(propId: number): Promise<void> {
  await purchaseProp(propId)
}
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/mall/" second-link="/mall/my-props">
      <template #first-link-text>Props</template>
      <template #second-link-text>My Props</template>
    </NavAlt>

    <video class="w-full mt-12" autoplay muted loop playsinline>
      <source :src="ASSETS.MALL_BG_VIDEO" type="video/mp4" />
    </video>

    <UserAvatar
      :animated="true"
      :frame-asset-url="resolvePropAsset(authStore?.user?.frame_id) ?? undefined"
      :img="authStore?.user?.avatar ?? undefined"
      class="w-28 -mt-32 mx-auto"
    />

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
        @update:model-value="(val: string | number) => handleCatalogTabChange(val)"
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
          @click="fetchCatalog({}, true)"
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
          @select="selectProp"
        />
      </div>

      <!-- Load More -->
      <div v-if="mallStore.catalog.hasMore && currentProps.length > 0" class="mt-4 text-center">
        <UButton
          color="neutral"
          variant="soft"
          :loading="mallStore.catalog.loading"
          @click="loadMoreCatalog"
        >
          Load More
        </UButton>
      </div>
    </div>

    <!-- Detail Modal -->
    <MallPropDetailModal
      :prop="mallStore.selectedProp"
      :open="!!mallStore.selectedProp"
      :is-purchasing="isPurchasing"
      @close="selectProp(null)"
      @purchase="handlePurchase"
    />
  </main>
</template>

<style scoped>

</style>