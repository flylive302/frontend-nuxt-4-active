<script setup lang="ts">
import { navigateTo } from 'nuxt/app'
import { ref, computed, toRef } from 'vue'
import { useDebounce } from '@vueuse/core'
const toast = useToast()

defineOptions({ name: 'ChooseDefaultReseller' })

/** -------- Props -------- */
type Colors = 'primary' | 'secondary' | 'tertiary' | 'success' | 'info' | 'warning' | 'error'
const props = withDefaults(defineProps<{
  color?: Colors
  endpoint?: string
}>(), {
  color: 'primary',
  endpoint: 'https://dummyjson.com/c/764f-c448-4151-8ac2'
})
const color = toRef(props, 'color')

/** -------- Types -------- */
type ResellerApiRow = {
  name: string
  signature: string
  contact: string
  avatar: string
}

type UiCommandItem = {
  id: string            // stable id (signature)
  label: string         // what palette searches/displays
  name: string          // person/org display name
  suffix?: string
  avatar?: { src: string }
  onSelect?: () => void // keyboard Enter / click
}

type CommandGroup = {
  id: string
  label: string
  items: UiCommandItem[]
}

/** -------- State -------- */
const isModalOpen = ref(false)
const searchTerm = ref('')
const debouncedSearchTerm = useDebounce(searchTerm, 250)

const selectedReseller = ref<null | Pick<ResellerApiRow, 'name' | 'contact' | 'avatar' | 'signature'>>(null)

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

/** -------- Data Fetch -------- */
const {
  data: resellerRows,
  status: fetchStatus,
  error: fetchError
} = await useFetch<ResellerApiRow[]>(
    () => props.endpoint,
    {
      query: { signature: debouncedSearchTerm }, // server-side search by signature
      watch: [debouncedSearchTerm, () => props.endpoint],
      lazy: true,
      default: () => []
    }
)

/** -------- Actions -------- */
function contactReseller(item: UiCommandItem) {
  navigateTo('/profile')
  toast.add({ title: `Contacting ${item.label}` })
}

function selectReseller(item: UiCommandItem) {
  selectedReseller.value = {
    signature: item.label,
    contact: item.suffix ?? '',
    avatar: item.avatar?.src ?? '',
    name: item.name
  }
  isModalOpen.value = false
  toast.add({ title: `${item.label} set as default` })
}

/** Map API rows → palette items */
const commandItems = computed<UiCommandItem[]>(() => {
  const rows = (resellerRows.value ?? []).filter(r => !!r.avatar?.trim())
  return rows.map((r) => {
    const it: UiCommandItem = {
      id: r.signature,              // stable key
      label: r.signature,           // palette search/display
      name: r.name,
      suffix: r.contact,
      avatar: { src: r.avatar }
    }
    it.onSelect = () => selectReseller(it)
    return it
  })
})

/** Single group for the palette */
const paletteGroups = computed<CommandGroup[]>(() => [
  {
    id: 'resellers',
    label: searchTerm.value ? `Resellers matching “${searchTerm.value}”` : 'Resellers',
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
          :color="color"
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
              :loading="fetchStatus === 'pending'"
              :groups="paletteGroups"
              placeholder="Search Resellers..."
              class="h-90"
              selected-icon="i-lucide-circle-check"
              virtualize
              @select="(it) => it?.onSelect?.()"
          >
            <!-- Custom row with two action icons on the right -->
            <template #item="{ item }">
              <div class="flex items-center justify-between gap-2 w-full">
                <div class="flex items-center gap-2 min-w-0">
                  <UAvatar
                      :src="item.avatar?.src"
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
                      @click.stop.prevent="contactReseller(item)"
                  />
                  <UButton
                      icon="i-lucide-circle-check"
                      variant="soft"
                      color="neutral"
                      :aria-label="`Select ${item.label} as default`"
                      @click.stop.prevent="selectReseller(item)"
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
              color="red"
              variant="subtle"
              title="Couldn’t load resellers"
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
        <!-- :img="selectedReseller.avatar" -->
        <Avatar :animated="true" />
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
            :color="color"
            :aria-label="`Contact ${selectedReseller.signature}`"
            to="/profile"
        />
      </div>
    </div>

    <p v-else class="text-xs text-muted">— No reseller selected —</p>
  </section>
</template>
