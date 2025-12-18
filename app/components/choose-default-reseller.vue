<script setup lang="ts">
import { navigateTo } from 'nuxt/app'
import { ref, computed, toRef, onMounted, watch } from 'vue'
import { useDebounce } from '@vueuse/core'
import type { Colors } from '~/types/colors'
import type { ResellerApiRow, ApiResponse } from '~/types/reseller'
import { useResellers } from '~/composables/useResellers'
import type { NormalizedError } from '~/composables/useApi'

const toast = useToast()

defineOptions({ name: 'ChooseDefaultReseller' })

/** -------- Props -------- */
const props = withDefaults(defineProps<{
  color?: Colors
}>(), {
  color: 'primary'
})
const color = toRef(props, 'color')

/** -------- Emits -------- */
const emit = defineEmits<{
  (e: 'update:selected', value: ResellerApiRow | null): void
  (e: 'update:selectedId', value: number | null): void
}>()

/** -------- Types -------- */
type UiCommandItem = {
  id: number            // reseller id for API calls
  label: string         // what palette searches/displays (signature)
  name: string          // person/org display name
  suffix?: string       // contact info
  avatar?: { src: string }  // Only include if avatar exists (not null)
  resellerId: number    // for update request
  onSelect?: () => void // keyboard Enter / click
}

type CommandGroup = {
  id: string
  label: string
  items: UiCommandItem[]
}

/** -------- Composables -------- */
const { fetchResellers, getDefaultReseller, updateDefaultReseller, normalizeError } = useResellers()

/** -------- State -------- */
const isModalOpen = ref(false)
const searchTerm = ref('')
const debouncedSearchTerm = useDebounce(searchTerm, 250)
const isUpdating = ref(false)
const selectedReseller = ref<ResellerApiRow | null>(null)
const resellers = ref<ResellerApiRow[]>([])
const isFetching = ref(false)
const fetchError = ref<NormalizedError | null>(null)

/** -------- Static class maps (no JIT misses) -------- */
const colorClasses: Record<Colors, { border: string; to: string; emphasis: string }> = {
  primary:   { border: 'border-primary',   to: 'to-primary/30',   emphasis: 'ring-1 ring-primary/40' },
  secondary: { border: 'border-secondary', to: 'to-secondary/30', emphasis: 'ring-1 ring-secondary/40' },
  tertiary:  { border: 'border-tertiary',  to: 'to-tertiary/30',  emphasis: 'ring-1 ring-tertiary/40' },
  success:   { border: 'border-success',   to: 'to-success/30',   emphasis: 'ring-1 ring-success/40' },
  info:      { border: 'border-info',      to: 'to-info/30',      emphasis: 'ring-1 ring-info/40' },
  warning:   { border: 'border-warning',   to: 'to-warning/30',   emphasis: 'ring-1 ring-warning/40' },
  error:     { border: 'border-error',     to: 'to-error/30',     emphasis: 'ring-1 ring-error/40' }
}

/** -------- Load Default Reseller on Mount -------- */
onMounted(async () => {
  try {
    const response = await getDefaultReseller()
    // Backend returns status: "success" not success: true
    if (response.status === 'success' && response.data) {
      selectedReseller.value = response.data
      emit('update:selected', response.data)
      emit('update:selectedId', response.data.id)
    }
  } catch (err) {
    // Silently fail - user may not have a default reseller yet
    console.warn('Failed to load default reseller:', err)
  }
})

/** -------- Data Fetch (Resellers List) -------- */
async function loadResellers(signature?: string) {
  isFetching.value = true
  fetchError.value = null

  try {
    const response = await fetchResellers(signature)
    // Backend returns status: "success" not success: true
    if (response.status === 'success') {
      resellers.value = response.data ?? []
      // Debug: Log response to help diagnose issues
      if (import.meta.dev) {
        console.log('[ChooseDefaultReseller] Loaded resellers:', {
          count: resellers.value.length,
          signature: signature || '(all)',
          resellers: resellers.value
        })
      }
    } else {
      resellers.value = []
      if (import.meta.dev) {
        console.warn('[ChooseDefaultReseller] Unexpected response status:', response.status)
      }
    }
  } catch (err) {
    const normalized = normalizeError(err)
    fetchError.value = normalized
    resellers.value = []
    if (import.meta.dev) {
      console.error('[ChooseDefaultReseller] Error loading resellers:', normalized)
    }
  } finally {
    isFetching.value = false
  }
}

watch(
  debouncedSearchTerm,
  (value) => {
    // Trim to avoid sending meaningless whitespace-only signatures
    const signature = value?.trim() || undefined
    void loadResellers(signature)
  },
  { immediate: true }
)

/** -------- Actions -------- */
function contactReseller(item: UiCommandItem) {
  navigateTo('/profile')
  toast.add({ title: `Contacting ${item.label}` })
}

async function selectReseller(item: UiCommandItem) {
  if (isUpdating.value) return

  isUpdating.value = true
  try {
    const response = await updateDefaultReseller(item.resellerId)

    // Backend returns status: "success" not success: true
    if (response.status === 'success' && response.data) {
      selectedReseller.value = response.data
      emit('update:selected', response.data)
      emit('update:selectedId', response.data.id)
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

/** Map API rows → palette items */
const commandItems = computed<UiCommandItem[]>(() => {
  return resellers.value.map((r) => {
    const it: UiCommandItem = {
      id: r.id,
      resellerId: r.id,
      label: r.signature,
      name: r.name,
      suffix: r.contact,
      avatar: r.avatar ? { src: r.avatar } : undefined
    }
    it.onSelect = () => selectReseller(it)
    return it
  })
})

/** Single group for the palette */
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
          variant="subtle"
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
              virtualize
              @select="(it: any) => it?.onSelect?.()"
          >
            <!-- Custom row with two action icons on the right -->
            <template #item="{ item }">
              <div class="flex items-center justify-between gap-2 w-full">
                <div class="flex items-center gap-2 min-w-0">
                  <UAvatar
                      :src="item.avatar?.src || undefined"
                      :class="['border-2', colorClasses[color].border]"
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

                <div class="flex gap-1 items-center shrink-0">
                  <UButton
                      icon="i-lucide-mail"
                      variant="soft"
                      color="neutral"
                      :aria-label="`Contact ${item.label}`"
                      @click.stop.prevent="contactReseller(item as UiCommandItem)"
                  />
                  <UButton
                      icon="i-lucide-circle-check"
                      variant="soft"
                      color="neutral"
                      :disabled="isUpdating"
                      :aria-label="`Select ${item.label} as default`"
                      @click.stop.prevent="selectReseller(item as UiCommandItem)"
                  />
                </div>
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

      <div
          v-if="selectedReseller"
          class="mt-2 flex gap-1 rounded-md border p-1 bg-gradient-to-br shadow-md"
          :class="[colorClasses[color].border, colorClasses[color].to, colorClasses[color].emphasis]"
      >
      <div class="max-w-16">
        <UAvatar
            :src="selectedReseller.avatar || undefined"
            :alt="selectedReseller.name"
            size="xl"
            :class="['border-2', colorClasses[color].border]"
        />
      </div>

      <div class="w-full leading-tight min-w-0">
        <p class="font-bold truncate">{{ selectedReseller.name }}</p>
        <p class="text-sm font-semibold text-muted truncate">{{ selectedReseller.signature }}</p>
        <p class="text-sm font-semibold text-muted truncate">{{ selectedReseller.contact }}</p>
      </div>

      <div class="flex flex-col justify-around">
        <UButton
            icon="i-lucide-mail"
            variant="subtle"
            :color="(color as any)"
            :aria-label="`Contact ${selectedReseller.signature}`"
            to="/profile"
        />
      </div>
    </div>

    <p v-else class="text-xs text-muted">— No reseller selected —</p>
  </section>
</template>
