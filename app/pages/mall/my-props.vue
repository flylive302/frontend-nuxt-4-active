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
const { equipProp, unequipProp, isEquipping } = useMallActions()
const { resolvePropAsset } = usePropLookup()
const {
  tabItems,
  selectedTab,
  initializeUserProps,
  handleUserPropsTabChange,
  selectUserProp,
  loadMoreUserProps,
  fetchUserProps,
} = useMallPage()

// ========================================
// Computed
// ========================================

/** User props from store (already filtered by API). */
const currentUserProps = computed(() => mallStore.userProps.items)

// ========================================
// Lifecycle
// ========================================

onMounted(() => initializeUserProps())

// ========================================
// Handlers (INTENT — delegate to composables)
// ========================================

async function handleEquip(userPropId: number): Promise<void> {
  await equipProp(userPropId)
}

async function handleUnequip(userPropId: number): Promise<void> {
  await unequipProp(userPropId)
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
        animated
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
        variant="link"
        :items="tabItems"
        :ui="{
          trigger: 'min-w-fit mr-2 data-[state=active]:bg-secondary rounded-none inset-shadow-sm',
          list: 'overflow-x-scroll min-h-fit overflow-y-hidden',
        }"
        :content="false"
        @update:model-value="(val: string | number) => handleUserPropsTabChange(val)"
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
          @click="fetchUserProps({}, true)"
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
      <div v-else class="grid grid-cols-2 gap-2 mt-4">
        <MallMyPropCard
          v-for="userProp in currentUserProps"
          :key="userProp.id"
          :user-prop="userProp"
          :is-equipping="isEquipping === userProp.id"
          @equip="handleEquip"
          @unequip="handleUnequip"
          @select="selectUserProp"
        />
      </div>

      <!-- Load More -->
      <div v-if="mallStore.userProps.hasMore && currentUserProps.length > 0" class="mt-4 text-center">
        <UButton
          color="neutral"
          variant="soft"
          :loading="mallStore.userProps.loading"
          @click="loadMoreUserProps"
        >
          Load More
        </UButton>
      </div>
    </div>

    <!-- Detail Modal -->
    <MallMyPropDetailModal
      :user-prop="mallStore.selectedUserProp"
      :open="!!mallStore.selectedUserProp"
      :is-equipping="isEquipping === mallStore.selectedUserProp?.id"
      @close="selectUserProp(null)"
      @equip="handleEquip"
      @unequip="handleUnequip"
    />
  </main>
</template>

<style scoped>

</style>