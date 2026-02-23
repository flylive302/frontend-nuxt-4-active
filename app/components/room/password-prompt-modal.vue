<script setup lang="ts">
// ========================================
// Room Password Prompt Modal
// ========================================
//
// Shown when a user tries to enter a password-protected room
// they don't own. Calls POST /rooms/{roomId}/join to verify.
// ========================================

import type { Room } from '~/types/room/room'

// ========================================
// Props & Emits
// ========================================

const props = defineProps<{
  room: Room
}>()

const emit = defineEmits<{
  (e: 'success'): void
}>()

const open = defineModel<boolean>('open', { default: false })

// ========================================
// State
// ========================================

const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

const { api, normalizeError } = useApi()

// ========================================
// Handlers
// ========================================

/** Verify password against backend */
async function handleSubmit(): Promise<void> {
  if (!password.value.trim()) {
    errorMessage.value = 'Password is required'
    return
  }

  loading.value = true
  errorMessage.value = ''

  try {
    await api(`/rooms/${props.room.id}/join`, {
      method: 'POST',
      body: { password: password.value },
    })

    // Success — password verified
    open.value = false
    emit('success')
  } catch (err) {
    const normalized = normalizeError(err)
    errorMessage.value = normalized.message || 'Incorrect password'
  } finally {
    loading.value = false
  }
}

/** Reset on close */
watch(open, (isOpen) => {
  if (!isOpen) {
    password.value = ''
    errorMessage.value = ''
  }
})
</script>

<template>
  <UDrawer v-model:open="open" title="Password Required" description="This room is password protected.">
    <template #content>
      <div class="px-4 mt-3 pb-6 space-y-4">
        <div class="flex items-center gap-3 bg-neutral-800 rounded-lg p-3">
          <UserAvatar :img="room.logo" :animated="true" class="w-12" />
          <div>
            <h3 class="text-base font-bold">{{ room.name }}</h3>
            <UBadge color="warning" variant="subtle" size="sm">
              Password Protected
            </UBadge>
          </div>
        </div>

        <UFormField label="Enter Room Password" :error="errorMessage || undefined">
          <UInput
            v-model="password"
            type="password"
            placeholder="Enter password..."
            icon="i-lucide-lock"
            size="xl"
            class="w-full"
            autofocus
            @keydown.enter="handleSubmit"
          />
        </UFormField>

        <UButton
          icon="i-lucide-door-open"
          color="primary"
          size="xl"
          class="w-full justify-center"
          :loading="loading"
          @click="handleSubmit"
        >
          Enter Room
        </UButton>

        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="w-full justify-center"
          @click="open = false"
        >
          Cancel
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
