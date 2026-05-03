<script setup lang="ts">
// ========================================
// VIP Gift Modal
// ========================================
// Follower/following picker for VIP gifting flow.
// Allows selecting a recipient from the user's social connections.

import type { MinimalUser } from '~/types/user/bootstrap'

// ========================================
// Props & Emits
// ========================================

const props = defineProps<{
  open: boolean
  levelName: string
  price: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'confirm': [recipient: MinimalUser]
}>()

// ========================================
// Composables
// ========================================

const { filteredRecipients, selectedRecipient, isLoading, searchQuery, selectRecipient, fetchRecipients } = useVipGift()

// ========================================
// Computed
// ========================================

const isOpen = computed({
  get: () => props.open,
  set: (val: boolean) => emit('update:open', val),
})

// ========================================
// Lifecycle
// ========================================

watch(() => props.open, (open) => {
  if (open) {
    selectedRecipient.value = null
    searchQuery.value = ''
    fetchRecipients()
  }
})

// ========================================
// Handlers
// ========================================

function handleConfirm() {
  if (selectedRecipient.value) {
    emit('confirm', selectedRecipient.value)
  }
}
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{
      overlay: 'bg-black/10 backdrop-blur-xs',
    }"
  >
    <template #content>
      <div class="p-4">
        <!-- Header -->
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-bold text-white">
            Gift {{ levelName }}
          </h3>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            size="sm"
            aria-label="Close"
            @click="isOpen = false"
          />
        </div>

        <p class="mb-4 text-sm text-neutral-400">
          Choose a friend to gift VIP to for <span class="font-semibold text-amber-400">{{ price.toLocaleString() }} coins</span>
        </p>

        <!-- Search Bar -->
        <UInput
          v-model="searchQuery"
          placeholder="Search followers..."
          icon="i-heroicons-magnifying-glass"
          class="mb-3 w-full inset-shadow-sm inset-shadow-neutral-950"
          size="xl"
          color="tertiary"
          variant="soft"
        />

        <!-- Recipient List -->
        <div class="max-h-64 overflow-y-auto rounded-lg">
          <div
            v-if="isLoading"
            class="flex items-center justify-center py-8"
          >
            <UIcon name="i-heroicons-arrow-path" class="h-6 w-6 animate-spin text-neutral-400" />
          </div>

          <div
            v-else-if="filteredRecipients.length === 0"
            class="py-8 text-center text-neutral-500"
          >
            {{ searchQuery ? 'No matching users found' : 'No followers or followings found' }}
          </div>

          <button
            v-for="user in filteredRecipients"
            :key="user.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors"
            :class="selectedRecipient?.id === user.id
              ? 'bg-amber-500/20 ring-1 ring-amber-500/40'
              : 'hover:bg-neutral-800'"
            @click="selectRecipient(user)"
          >
            <NuxtImg
              :src="user.avatar || '/default-avatar.png'"
              :alt="user.name"
              class="h-10 w-10 rounded-full object-cover"
              loading="lazy"
              format="webp"
            />
            <div class="flex-1 text-left">
              <p class="text-sm font-medium text-white truncate">
                {{ user.name }}
              </p>
              <p class="text-xs text-neutral-400 truncate">
                {{ user.signature }}
              </p>
            </div>
            <UIcon
              v-if="selectedRecipient?.id === user.id"
              name="i-heroicons-check-circle-solid"
              class="h-5 w-5 text-amber-400"
            />
          </button>
        </div>

        <!-- Confirm Button -->
        <UButton
          size="xl"
          variant="solid"
          color="warning"
          class="mt-4 w-full justify-center"
          :disabled="!selectedRecipient"
          @click="handleConfirm"
        >
          Gift to {{ selectedRecipient?.name ?? '...' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>
