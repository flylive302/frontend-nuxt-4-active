<script setup lang="ts">
import { ROOM_THEME_COLORS } from '~/constants/room'
import type { SeatPickerOption } from '~/composables/room/useSeatPickerOptions'

// ========================================
// Room Theme Sub-Drawer
// ========================================
//
// Owner/admin: logo, background, theme color, seat count.
// Owner only: room name.
// ========================================

const open = defineModel<boolean>('open', { default: false })

// ========================================
// Composables
// ========================================

const { isRoomOwner } = useRoomPermissions()
const {
  thisRoom,
  editName,
  editColor,
  editMaxSeats,
  saving,
  logoUpload,
  logoPreview,
  isLogoUploading,
  selectLogoFile,
  bgUpload,
  bgPreview,
  isBgUploading,
  selectBgFile,
  syncFromRoom,
  releasePreviews,
  save,
} = useRoomSettingsForm()

const { seatOptions } = useSeatPickerOptions(thisRoom)

// ========================================
// Lifecycle
// ========================================

watch(open, (isOpen) => {
  if (isOpen) syncFromRoom()
})

onBeforeUnmount(releasePreviews)
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Theme"
    description="Room appearance and seats."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4 max-h-[80vh] overflow-y-auto">
        <div class="bg-neutral-800 rounded-lg p-3 space-y-4">
          <!-- Logo Upload (1:1 square) -->
          <UFormField label="Room Logo (Square)">
            <div class="flex justify-center">
              <FileUpload
                :current-image="logoPreview"
                :loading="isLogoUploading"
                crop
                :aspect-ratio="1"
                shape="circle"
                size="lg"
                label="Room Logo"
                @file-selected="selectLogoFile"
              />
            </div>
          </UFormField>

          <div v-if="isLogoUploading" class="space-y-1">
            <p class="text-xs text-center text-muted">Uploading logo...</p>
            <UProgress :value="logoUpload.state.value.progress" size="xs" color="primary" />
          </div>

          <!-- Background Upload (9:16) -->
          <UFormField label="Room Background (9:16)">
            <div class="flex justify-center">
              <FileUpload
                :current-image="bgPreview"
                :loading="isBgUploading"
                crop
                :aspect-ratio="9 / 16"
                shape="rounded"
                size="xl"
                label="Room Background"
                @file-selected="selectBgFile"
              />
            </div>
          </UFormField>

          <div v-if="isBgUploading" class="space-y-1">
            <p class="text-xs text-center text-muted">Uploading background...</p>
            <UProgress :value="bgUpload.state.value.progress" size="xs" color="primary" />
          </div>

          <!-- Theme Color -->
          <UFormField label="Theme Color">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in ROOM_THEME_COLORS"
                :key="color.value"
                type="button"
                class="size-8 rounded-full border-2 transition-all cursor-pointer hover:scale-110"
                :class="editColor === color.value ? 'border-white scale-110 ring-2 ring-white/30' : 'border-transparent'"
                :style="{ backgroundColor: color.value }"
                :title="color.label"
                @click="editColor = color.value"
              />
            </div>
          </UFormField>

          <!-- Room Name (Owner Only) -->
          <UFormField v-if="isRoomOwner" label="Room Name">
            <UInput v-model="editName" placeholder="Enter room name" icon="i-lucide-type" size="lg" class="w-full" />
          </UFormField>

          <!-- Max Seats (progression-aware — tiers above the room's seat_cap render locked) -->
          <UFormField label="Max Seats">
            <USelect v-model="editMaxSeats" :items="seatOptions" value-key="value" size="lg" class="w-full">
              <template #item-label="{ item }">
                <div class="flex items-center justify-between w-full gap-2">
                  <span>{{ (item as SeatPickerOption).label }}</span>
                  <span v-if="(item as SeatPickerOption).unlockLabel" class="text-xs text-neutral-400">
                    {{ (item as SeatPickerOption).unlockLabel }}
                  </span>
                </div>
              </template>
            </USelect>
          </UFormField>

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
