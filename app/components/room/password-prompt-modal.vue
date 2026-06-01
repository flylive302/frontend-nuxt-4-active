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
const showPassword = ref(false)

const { verifyRoomJoinPassword } = useRoomJoinPasswordVerify()

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

  const result = await verifyRoomJoinPassword(props.room.id, password.value)
  if (result.ok) {
    open.value = false
    emit('success')
  } else {
    errorMessage.value = result.message
  }
  loading.value = false
}

/** Reset on close */
watch(open, (isOpen) => {
  if (!isOpen) {
    password.value = ''
    errorMessage.value = ''
    showPassword.value = false
  }
})
</script>

<template>
  <UDrawer v-model:open="open" title="Password Required" description="This room is password protected.">
    <template #content>
      <div class="px-4 mt-3 pb-6 space-y-4">
        <div class="flex items-center gap-3 bg-neutral-800 rounded-lg p-3">
          <UserAvatar :img="room.logo" :animated="true" class="w-24" />
          <div class="w-full">
            <MarqueeName text-class="text-base font-bold" :name="room.name" />
            <UBadge color="warning" variant="subtle" size="sm">
              This Room is Password Protected
            </UBadge>
          </div>
        </div>

        <UFormField label="Enter Room Password" :error="errorMessage || undefined">
          <UInput
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Enter password..."
            icon="i-lucide-lock"
            size="xl"
            class="w-full"
            autofocus
            @keydown.enter="handleSubmit"
          >
            <template #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="showPassword ? 'Hide password' : 'Show password'"
                :padded="false"
                @click="showPassword = !showPassword"
              />
            </template>
          </UInput>
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
