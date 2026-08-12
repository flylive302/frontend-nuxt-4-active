<script setup lang="ts">
// ========================================
// Imports
// ========================================
import { ref, computed, watch } from 'vue'
import { useDebounce } from '@vueuse/core'
import { useUserSearch } from '~/composables/user/useUserSearch'
import { useColorClasses } from '~/composables/shared/useColorClasses'
import type { MinimalUser } from '~/types/user/bootstrap'

// ========================================
// Props & Emits
// ========================================
const props = withDefaults(defineProps<{
  open?: boolean
}>(), {
  open: false
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select': [user: MinimalUser]
}>()

// ========================================
// Composables
// ========================================
const { users, loading, error, searchUsers } = useUserSearch()
const { borderClass, gradientClass } = useColorClasses(ref('primary'))

// ========================================
// State
// ========================================
const isOpen = computed({
  get: () => props.open,
  set: (value) => emit('update:open', value)
})

const searchTerm = ref('')
const debouncedSearchTerm = useDebounce(searchTerm, 300)
const selectedUser = ref<MinimalUser | null>(null)

// ========================================
// Types for Command Palette
// ========================================
type CommandItem = {
  id: number
  label: string // Searchable text (Name / Signature)
  name: string
  suffix?: string
  avatar?: { src: string }
  user: MinimalUser // Keep ref to original search result
}

type CommandGroup = {
  id: string
  label: string
  items: CommandItem[]
  ignoreFilter: boolean
}

// ========================================
// Computed
// ========================================
const commandItems = computed<CommandItem[]>(() =>
  users.value.map((u) => ({
    id: u.id,
    label: u.name || `User ${u.id}`,
    name: `ID: ${u.signature}`,
    avatar: u.avatar ? { src: u.avatar } : undefined,  // Avatar is now string
    user: u
  }))
)

// Nuxt UI CommandPalette expects groups
const paletteGroups = computed<CommandGroup[]>(() => [
  {
    id: 'users',
    label: searchTerm.value ? `Users matching "${searchTerm.value}"` : 'Recent Users',
    items: commandItems.value,
    ignoreFilter: true
  }
])

// ========================================
// Watchers
// ========================================
watch(
  debouncedSearchTerm,
  (value) => {
    if (value && value.trim().length > 0) {
      searchUsers(value)
    }
  }
)

// Reset state when drawer opens
watch(isOpen, (val) => {
  if (val) {
    searchTerm.value = ''
    selectedUser.value = null
    // Attempt to load initial users (if backend supports empty search)
    searchUsers('') 
  }
})

// ========================================
// Actions
// ========================================
function handleSelect(item: CommandItem) {
  selectedUser.value = item.user
}

function handleConfirm() {
  if (selectedUser.value) {
    emit('select', selectedUser.value)
    isOpen.value = false
  }
}
</script>

<template>
  <UDrawer
    v-model:open="isOpen"
    title="Invite User"
    description="Search by @Signature"
  >
    <template #content>
      <!-- Search Mode -->
      <template v-if="!selectedUser">
        <UCommandPalette
          v-model:search-term="searchTerm"
          :loading="loading"
          :groups="paletteGroups"
          placeholder="Search items..."
          class="h-96 flex-1"
          :virtualize="{ estimateSize: 60 }"
          :ui="{ item: 'bg-elevated/60 rounded-md mb-1' }"
          @select="handleSelect"
        >
          <template #item="{ item }">
            <div 
              class="w-full flex items-center gap-3 py-1 cursor-pointer"
              @click="handleSelect(item as CommandItem)"
            >
              <UAvatar
                :src="item.avatar?.src"
                :alt="item.label"
                size="lg"
                :class="['border', borderClass]"
              />
              <div class="flex items-center gap-2 w-full text-lg">
                <p class=" font-semibold truncate">{{ item.label }}</p>
                <span v-if="item.name" class="font-medium text-primary/80">{{ item.name }}</span>
                <span v-if="item.suffix">{{ item.suffix }}</span>
              </div>
              <UIcon name="i-lucide-chevron-right" class="size-8 text-muted/50" />
            </div>
          </template>

          <template #empty>
            <div class="flex flex-col items-center justify-center py-12 text-center text-muted">
              <UIcon name="i-lucide-search-x" class="size-10 mb-2 opacity-50" />
              <p class="text-sm">No users found.</p>
              <p v-if="error" class="text-xs text-error mt-1">{{ error }}</p>
            </div>
          </template>
        </UCommandPalette>
      </template>

      <!-- Preview Mode (Selected) -->
      <template v-else>
        <div class="p-4 space-y-6">
          <div class="rounded-xl p-4 shadow-sm border border-white/10 bg-elevated/50 relative overflow-hidden" :class="[gradientClass]">
            <!-- Background decoration -->
            <div class="absolute -right-6 -top-6 size-24 bg-primary/20 blur-2xl rounded-full pointer-events-none" />
            
            <div class="flex flex-col items-center text-center relative z-10">
              <LazyUserAvatar :img="selectedUser.avatar ?? undefined" :frame-id="selectedUser.frame_id" :animated="true" class="size-24"/>
              
              <h3 class="text-xl font-bold">{{ selectedUser.name }}</h3>
              
              <div class="flex items-center gap-2 mt-1">
                <ProfileBadge v-if="selectedUser.signature" :show-badge="false" :txt="selectedUser.signature"/>
                <UBadge color="secondary" :icon="getGenderInfo(selectedUser.gender).icon" size="sm" class="w-fit text-white p-1">
                  {{ getAge(selectedUser.date_of_birth) }}
                </UBadge>
                <CountryFlag :code="selectedUser.country" class="rounded overflow-hidden h-6 size-8 shadow-lg"/>
              </div>

            </div>
          </div>

          <div class="flex items-center gap-3 pt-4">
            <UButton
              color="neutral"
              variant="soft"
              class="flex-1 justify-center"
              @click="selectedUser = null"
            >
              Back to Search
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              class="flex-1 justify-center"
              icon="i-lucide-mail"
              @click="handleConfirm"
            >
              Send Invite
            </UButton>
          </div>
        </div>
      </template>
    </template>
  </UDrawer>
</template>
