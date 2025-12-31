<script setup lang="ts">
// ========================================
// Imports
// ========================================
import { ref, computed, watch } from 'vue'
import { useDebounce } from '@vueuse/core'
import { useUserSearch } from '~/composables/useUserSearch'
import { useColorClasses } from '~/composables/useColorClasses'
import type { User } from '~/types/auth'

// ========================================
// Props & Emits
// ========================================
const props = withDefaults(defineProps<{
  open: boolean
}>(), {
  open: false
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'select': [user: User]
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
const selectedUser = ref<User | null>(null)

// ========================================
// Types for Command Palette
// ========================================
type CommandItem = {
  id: number
  label: string // Searchable text (Name / Signature)
  name: string
  suffix?: string
  avatar?: { src: string }
  user: User // Keep ref to original object
}

type CommandGroup = {
  id: string
  label: string
  items: CommandItem[]
}

// ========================================
// Computed
// ========================================
const commandItems = computed<CommandItem[]>(() =>
  users.value.map((u) => ({
    id: u.id,
    label: u.name || `User ${u.id}`,
    name: u.signature ? `@${u.signature}` : `ID: ${u.id}`,
    suffix: u.signature ? `ID: ${u.id}` : undefined,
    avatar: u.avatar?.medium ? { src: u.avatar.medium } : undefined,
    user: u
  }))
)

// Nuxt UI CommandPalette expects groups
const paletteGroups = computed<CommandGroup[]>(() => [
  {
    id: 'users',
    label: searchTerm.value ? `Users matching "${searchTerm.value}"` : 'Recent Users',
    items: commandItems.value
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
    description="Search by ID, Name, or @Signature"
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
                size="md"
                :class="['border', borderClass]"
              />
              <div class="text-left min-w-0 flex-1">
                <p class="text-sm font-semibold truncate">{{ item.label }}</p>
                <div class="flex items-center gap-2 text-xs text-muted">
                  <span v-if="item.name" class="font-medium text-primary/80">{{ item.name }}</span>
                  <span v-if="item.suffix">{{ item.suffix }}</span>
                </div>
              </div>
              <UIcon name="i-lucide-chevron-right" class="text-muted/50" />
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
          <div 
            class="rounded-xl p-4 shadow-sm border border-white/5 bg-elevated/50 relative overflow-hidden"
            :class="[gradientClass]"
          >
            <!-- Background decoration -->
            <div class="absolute -right-6 -top-6 size-24 bg-primary/20 blur-2xl rounded-full pointer-events-none" />
            
            <div class="flex flex-col items-center text-center relative z-10">
              <UAvatar
                :src="selectedUser.avatar?.large || selectedUser.avatar?.medium"
                :alt="selectedUser.name"
                size="3xl"
                :class="['border-4 mb-3', borderClass]"
              />
              
              <h3 class="text-xl font-bold">{{ selectedUser.name }}</h3>
              
              <div class="flex items-center gap-2 mt-1 mb-4">
                <UBadge variant="soft" color="primary" size="sm">
                  ID: {{ selectedUser.id }}
                </UBadge>
                <UBadge v-if="selectedUser.signature" variant="subtle" color="neutral" size="sm">
                  @{{ selectedUser.signature }}
                </UBadge>
              </div>

              <!-- Stats / Info can go here if available in User model -->
              <div class="grid grid-cols-2 gap-4 w-full mt-2 pt-4 border-t border-white/10">
                <div class="flex flex-col">
                  <span class="text-xs text-muted uppercase tracking-wider">Country</span>
                  <span class="font-semibold">{{ selectedUser.phone_country || '—' }}</span>
                </div>
                <div class="flex flex-col">
                  <span class="text-xs text-muted uppercase tracking-wider">Joined</span>
                  <span class="font-semibold">{{ selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : '—' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-3 pt-4">
            <UButton
              color="neutral"
              variant="ghost"
              class="flex-1"
              @click="selectedUser = null"
            >
              Back to Search
            </UButton>
            <UButton
              color="primary"
              variant="solid"
              size="lg"
              class="flex-1"
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
