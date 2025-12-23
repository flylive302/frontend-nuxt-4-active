<script setup lang="ts">
import { ref, computed, toRef, onMounted, watch } from 'vue'
import { useDebounce } from '@vueuse/core'
import type { Colors } from '~/types/colors'
import type { ResellerApiRow } from '~/types/reseller'
import { useResellers } from '~/composables/useResellers'
import { useColorClasses } from '~/composables/useColorClasses'
import type { NormalizedError } from '~/composables/useApi'

defineOptions({ name: 'ChooseDefaultReseller' })

// ========================================
// Props
// ========================================
const props = withDefaults(defineProps<{
  color?: Colors
}>(), {
  color: 'primary'
})

const color = toRef(props, 'color')

// ========================================
// Composables
// ========================================
const toast = useToast()
const { fetchResellers, getDefaultReseller, updateDefaultReseller, normalizeError } = useResellers()
const { borderClass, gradientClass } = useColorClasses(color)

// ========================================
// State
// ========================================
const isModalOpen = ref(false)
const searchTerm = ref('')
const debouncedSearchTerm = useDebounce(searchTerm, 250)
const isUpdating = ref(false)
const selectedReseller = ref<ResellerApiRow | null>(null)
const resellers = ref<ResellerApiRow[]>([])
const isFetching = ref(false)
const fetchError = ref<NormalizedError | null>(null)

// ========================================
// Types
// ========================================
type CommandItem = {
  id: number
  label: string
  name: string
  suffix?: string
  avatar?: { src: string }
}

type CommandGroup = {
  id: string
  label: string
  items: CommandItem[]
}

// ========================================
// Lifecycle
// ========================================
onMounted(async () => {
  try {
    const response = await getDefaultReseller()
    if (response.status === 'success' && response.data) {
      selectedReseller.value = response.data
    }
  } catch {
    // Silently fail - user may not have a default reseller yet
  }
})

// ========================================
// Data Fetching
// ========================================
async function loadResellers(signature?: string): Promise<void> {
  isFetching.value = true
  fetchError.value = null

  try {
    const response = await fetchResellers(signature)
    resellers.value = response.status === 'success' ? (response.data ?? []) : []
  } catch (err) {
    fetchError.value = normalizeError(err)
    resellers.value = []
  } finally {
    isFetching.value = false
  }
}

watch(
  debouncedSearchTerm,
  (value) => {
    const signature = value?.trim() || undefined
    void loadResellers(signature)
  },
  { immediate: true }
)

// ========================================
// Actions
// ========================================
async function selectReseller(item: CommandItem): Promise<void> {
  if (isUpdating.value) return

  isUpdating.value = true
  try {
    const response = await updateDefaultReseller(item.id)

    if (response.status === 'success' && response.data) {
      selectedReseller.value = response.data
      isModalOpen.value = false
      toast.add({ title: `${item.name} set as default`, color: 'success' })
    }
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({
      title: 'Failed to update reseller',
      description: normalized.message,
      color: 'error'
    })
  } finally {
    isUpdating.value = false
  }
}

// ========================================
// Computed
// ========================================
const commandItems = computed<CommandItem[]>(() =>
  resellers.value.map((r) => ({
    id: r.id,
    label: r.signature,
    name: r.name,
    suffix: r.contact,
    avatar: r.avatar ? { src: r.avatar } : undefined
  }))
)

const paletteGroups = computed<CommandGroup[]>(() => [
  {
    id: 'resellers',
    label: searchTerm.value ? `Resellers matching "${searchTerm.value}"` : 'Resellers',
    items: commandItems.value
  }
])
</script>

<template>
  <section class="space-y-2">
    <header class="flex items-end justify-between">
      <h3 class="text-lg font-semibold leading-none">Default Reseller</h3>

      <UButton
        label="Change"
        :color="(color as any)"
        variant="soft"
        trailing-icon="i-lucide-search"
        aria-haspopup="dialog"
        aria-controls="choose-reseller"
        @click="isModalOpen = true"
      />

      <UDrawer
        id="choose-reseller"
        v-model:open="isModalOpen"
        title="Choose default reseller"
        description="Search and select a reseller from the list."
      >
        <template #content>
          <UCommandPalette
            v-model:search-term="searchTerm"
            :loading="isFetching || isUpdating"
            :groups="paletteGroups"
            placeholder="Search Resellers..."
            class="h-90"
            selected-icon="i-lucide-circle-check"
            :virtualize="{ estimateSize: 54 }"
            :ui="{item: 'bg-elevated/60 rounded-md'}"
            @select="(item: CommandItem) => selectReseller(item)"
          >
            <template #item="{ item }">
              <div class="w-full flex items-center justify-between" @click.stop.prevent="selectReseller(item as CommandItem)">
                <div class="flex items-center gap-2">
                  <UAvatar
                      :src="item.avatar?.src"
                      :class="['border', borderClass]"
                      size="lg"
                      :alt="item.name"
                  />
                  <div class="text-left min-w-0">
                    <p class="text-base truncate">{{ item.label }}</p>
                    <p class="text-sm font-semibold text-muted leading-3.5 truncate">
                      {{ item.name }}
                    </p>
                  </div>
                </div>

                <UButton
                    icon="i-lucide-circle-check"
                    variant="subtle"
                    color="neutral"
                    :disabled="isUpdating"
                    :aria-label="`Select ${item.label} as default`"
                />
              </div>
            </template>

            <template #empty>
              <div class="py-6 text-center text-sm opacity-70">
                No reseller found.
              </div>
            </template>
          </UCommandPalette>

          <UAlert
            v-if="fetchError"
            color="error"
            variant="subtle"
            title="Couldn't load resellers"
            description="Network error. Please try again."
          />
        </template>
      </UDrawer>
    </header>

    <div v-if="selectedReseller" class="mt-2 flex gap-2 rounded-md p-2 shadow-md" :class="[gradientClass]">
      <div class="max-w-16 flex flex-col justify-center">
        <UAvatar
            :src="selectedReseller.avatar || undefined"
            :alt="selectedReseller.name"
            size="xl"
            :class="['border-2', borderClass]"
        />
      </div>

      <div class="w-full leading-tight min-w-0">
        <p class="font-bold truncate">
          {{ selectedReseller.name }}
          <span class="text-sm font-semibold text-muted truncate">{{ selectedReseller.signature }}</span>
        </p>
        <p class="text-sm font-semibold text-muted truncate">{{ selectedReseller.contact }}</p>
      </div>
    </div>

    <p v-else class="text-xs text-muted">— No reseller selected —</p>
  </section>
</template>
