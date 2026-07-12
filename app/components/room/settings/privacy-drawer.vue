<script setup lang="ts">
// ========================================
// Room Privacy Sub-Drawer (Owner Only)
// ========================================
//
// Public/private toggle + password protection.
// ========================================

const open = defineModel<boolean>('open', { default: false })

const showPassword = ref(false)

// ========================================
// Composables
// ========================================

const {
  thisRoom,
  editType,
  editPassword,
  saving,
  syncFromRoom,
  save,
  removePassword,
} = useRoomSettingsForm()

// ========================================
// Constants
// ========================================

const typeOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Private', value: 'private' },
]

// ========================================
// Lifecycle
// ========================================

watch(open, (isOpen) => {
  if (isOpen) syncFromRoom()
})
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Privacy"
    description="Room visibility and password protection."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4 max-h-[80vh] overflow-y-auto">
        <div class="bg-neutral-800 rounded-lg p-3 space-y-4">
          <!-- Room Type -->
          <UFormField label="Room Type">
            <USelect v-model="editType" :items="typeOptions" value-key="value" size="lg" class="w-full" />
          </UFormField>

          <!-- Password -->
          <UFormField label="Set / Change Password">
            <UInput
              v-model="editPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Leave blank to keep current"
              icon="i-lucide-lock"
              size="lg"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  :padded="false"
                  @click="() => { showPassword = !showPassword }"
                />
              </template>
            </UInput>
          </UFormField>

          <!-- Remove Password -->
          <UButton
            v-if="thisRoom?.is_password_protected"
            icon="i-lucide-unlock"
            color="warning"
            variant="soft"
            size="sm"
            class="w-full justify-center"
            :loading="saving"
            @click="removePassword"
          >
            Remove Password
          </UButton>

          <!-- Save -->
          <UButton
            icon="i-lucide-save"
            color="primary"
            size="xl"
            class="w-full justify-center"
            :loading="saving"
            @click="() => { void save() }"
          >
            Save Changes
          </UButton>
        </div>
      </div>
    </template>
  </UDrawer>
</template>
