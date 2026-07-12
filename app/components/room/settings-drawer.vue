<script setup lang="ts">
import { createLogger } from '~/utils/logger'
import { DEFAULT_SEAT_COUNT } from '~/constants/room'
import type { SeatPickerOption } from '~/composables/room/useSeatPickerOptions'
// ========================================
// Room Settings Drawer
// ========================================
//
// Owner: Full room editing (logo, background, name, type, password, color, seats)
// Members: Room info + leave
// Non-members: Join/leave actions
// ========================================

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })

// ========================================
// Stores & Composables
// ========================================

const roomStore = useRoomStore()
const authStore = useAuthStore()
const { fetchMyJoinRequests, myJoinRequests } = useRoomJoinRequests()
const { receivedInvitations, fetchReceivedInvitations } = useRoomInvitations()
const { myMembership, fetchMyMembership } = useRoomMembers()
const { patchRoom, normalizeError } = useRoomSettingsApi()
const { createUploadState } = useImageUpload()
const { socket } = useAudioSocket()
const toast = useToast()
const log = createLogger('[RoomSettings]')

// Music player (restricted to canEdit users)
const {
  playerState: musicPlayerState,
  isMusicPlayingInRoom,
  isActive: isMusicActive,
  addTracks: addMusicTracks,
  play: playMusic,
  takeover: takeoverMusic,
} = useRoomAudioPlayer(socket)

// ========================================
// Computed
// ========================================

const thisRoom = computed(() => roomStore.currentRoom)
const { isRoomOwner } = useRoomPermissions()

/** Membership state for current user */
const membershipState = computed(() => {
  if (!thisRoom.value) return 'none'
  const roomId = thisRoom.value.id
  if (isRoomOwner.value) return 'owner'
  if (myMembership.value && myMembership.value.room_id === roomId) {
    return myMembership.value.role === 'admin' ? 'admin' : 'member'
  }
  const pendingRequest = myJoinRequests.value.items.find(
    (r) => r && (r.room_id === roomId || r.room?.id === roomId) && r.status === 'pending'
  )
  if (pendingRequest) return 'pending_request'
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room_id === roomId || inv.room?.id === roomId) && inv.status === 'pending'
  )
  if (pendingInvite) return 'has_invitation'
  return 'none'
})

/** Whether current user can edit room settings (owner or admin) */
const canEdit = computed(() => {
  if (isRoomOwner.value) return true
  return membershipState.value === 'admin'
})

/** Whether current user is the room owner (for password-only controls) */
const isOwnerOnly = computed(() => isRoomOwner.value)

// ========================================
// Music Player State (Owner / Admin only)
// ========================================

const showMusicUploader = ref(false)
/** Block List sub-drawer (owner/admin only entry point). */
const showBlockList = ref(false)
const isMusicLoading = ref(false)
/** Set when the uploader was opened to force-take (owner) vs. normal play. */
const forceTakeMode = ref(false)

/** True when no music is playing or this user is the current music player. */
const canPlayMusic = computed(() =>
  !isMusicPlayingInRoom.value || musicPlayerState.userId === authStore.user?.id
)

/**
 * The owner can force-take a live slot held by someone else (ADR-0006 hierarchy);
 * non-owner admins cannot interrupt and must wait for the slot to free.
 */
const canForceTakeMusic = computed(() =>
  isRoomOwner.value && isMusicPlayingInRoom.value && musicPlayerState.userId !== authStore.user?.id
)

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '')

/**
 * Append the selected audio files to the Playlist. Starts the DJ session if one
 * is not already live; otherwise the tracks join the queue without interrupting
 * playback (the orchestrator owns the engine + mediasoup producer lifecycle).
 */
async function handleMusicFilesSelected(files: File[]): Promise<void> {
  if (!currentRoomId.value) return
  isMusicLoading.value = true
  try {
    const added = addMusicTracks(files)
    if (added.length === 0) {
      toast.add({ title: 'Playlist Full', description: 'No more tracks can be added.', color: 'warning' })
      return
    }
    showMusicUploader.value = false
    if (forceTakeMode.value) {
      await takeoverMusic(currentRoomId.value)
    } else if (!isMusicActive.value) {
      await playMusic(currentRoomId.value)
    }
  } catch (err) {
    // The orchestrator already surfaces socket failures as toasts; this guards
    // any remaining throw (e.g. producer transport setup) from bubbling up as an
    // unhandled rejection.
    log.warn('Music playback could not start', err)
    toast.add({ title: 'Music', description: 'Could not start music playback. Please try again.', color: 'error' })
  } finally {
    forceTakeMode.value = false
    isMusicLoading.value = false
  }
}

/** Open the file picker in normal vs. owner force-take mode. */
function openMusicPicker(force: boolean): void {
  forceTakeMode.value = force
  showMusicUploader.value = true
}

// ========================================
// Form State (Owner Only)
// ========================================

const editName = ref('')
const editPassword = ref('')
const editType = ref<'public' | 'private'>('public')
const editColor = ref('')
const editMaxSeats = ref(DEFAULT_SEAT_COUNT)
const saving = ref(false)
const showSettingsPassword = ref(false)

// ========================================
// Logo Upload State
// ========================================

const logoUpload = createUploadState()
const logoPreview = ref<string | null>(null)
const logoFile = ref<File | null>(null)
const isLogoUploading = computed(() => logoUpload.state.value.status === 'uploading')

function handleLogoFileSelected(file: File): void {
  logoFile.value = file
  if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
  logoPreview.value = URL.createObjectURL(file)
}

// ========================================
// Background Upload State
// ========================================

const bgUpload = createUploadState()
const bgPreview = ref<string | null>(null)
const bgFile = ref<File | null>(null)
const isBgUploading = computed(() => bgUpload.state.value.status === 'uploading')

function handleBgFileSelected(file: File): void {
  bgFile.value = file
  if (bgPreview.value) URL.revokeObjectURL(bgPreview.value)
  bgPreview.value = URL.createObjectURL(file)
}

// ========================================
// Sync form on open
// ========================================

watch(open, (isOpen) => {
  if (isOpen && thisRoom.value) {
    editName.value = thisRoom.value.name ?? ''
    editPassword.value = ''
    editType.value = thisRoom.value.is_private ? 'private' : 'public'
    editColor.value = thisRoom.value.primary_color ?? ''
    editMaxSeats.value = thisRoom.value.max_seats ?? DEFAULT_SEAT_COUNT
    logoPreview.value = thisRoom.value.logo ?? null
    bgPreview.value = thisRoom.value.background ?? null
    logoFile.value = null
    bgFile.value = null
  }
})

// ========================================
// Theme Color Palette
// ========================================

const THEME_COLORS = [
  { label: 'Rose', value: '#e11d48' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Cyan', value: '#0891b2' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Pink', value: '#db2777' },
] as const

const typeOptions = [
  { label: 'Public', value: 'public' },
  { label: 'Private', value: 'private' },
]

const { seatOptions } = useSeatPickerOptions(thisRoom)

// ========================================
// Handlers — Room Settings
// ========================================

/** Save all room settings */
async function handleSaveSettings(): Promise<void> {
  if (!thisRoom.value || !canEdit.value) return

  saving.value = true
  try {
    const body: Record<string, unknown> = {}

    if (editName.value && editName.value !== thisRoom.value.name) {
      body.name = editName.value
    }
    if (editPassword.value) {
      body.password = editPassword.value
    }
    if (editType.value !== (thisRoom.value.is_private ? 'private' : 'public')) {
      body.type = editType.value
    }
    if (editColor.value) {
      body.primary_color = editColor.value
    }
    if (editMaxSeats.value !== thisRoom.value.max_seats) {
      body.max_seats = editMaxSeats.value
    }

    // Upload logo if changed
    if (logoFile.value) {
      const result = await logoUpload.upload(logoFile.value, 'rooms')
      if (!result || !result.url) {
        toast.add({ title: 'Upload Failed', description: 'Failed to upload logo.', color: 'error' })
        saving.value = false
        return
      }
      body.logo_url = result.url
      body.logo_file_id = result.fileId
    }

    // Upload background if changed
    if (bgFile.value) {
      const result = await bgUpload.upload(bgFile.value, 'rooms')
      if (!result || !result.url) {
        toast.add({ title: 'Upload Failed', description: 'Failed to upload background.', color: 'error' })
        saving.value = false
        return
      }
      body.background_url = result.url
      body.background_file_id = result.fileId
    }

    if (Object.keys(body).length === 0) {
      toast.add({ title: 'No Changes', description: 'Nothing to update.', color: 'info' })
      saving.value = false
      return
    }

    // Send PATCH — response includes updated room data
    const response = await patchRoom(thisRoom.value.id, body)

    if (response.data && thisRoom.value) {
      Object.assign(thisRoom.value, response.data)
    }

    toast.add({ title: 'Settings Saved', description: 'Room settings updated.', color: 'success' })
    logoFile.value = null
    bgFile.value = null
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({ title: 'Error', description: normalized.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

/** Remove password protection */
async function handleRemovePassword(): Promise<void> {
  if (!thisRoom.value || !canEdit.value) return
  saving.value = true
  try {
    const response = await patchRoom(thisRoom.value.id, { password: '' })

    if (response.data && thisRoom.value) {
      Object.assign(thisRoom.value, response.data)
    }

    toast.add({ title: 'Password Removed', description: 'Room is no longer password protected.', color: 'success' })
  } catch (err) {
    const normalized = normalizeError(err)
    toast.add({ title: 'Error', description: normalized.message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  await Promise.all([fetchReceivedInvitations(true), fetchMyMembership(), fetchMyJoinRequests()])
})

onBeforeUnmount(() => {
  if (logoPreview.value && logoFile.value) URL.revokeObjectURL(logoPreview.value)
  if (bgPreview.value && bgFile.value) URL.revokeObjectURL(bgPreview.value)
})
</script>

<template>
  <UDrawer 
    v-model:open="open" 
    title="Room Settings" 
    description="Room settings and configuration."
    style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
  >
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4 max-h-[80vh] overflow-y-auto">
        <!-- Owner: Room Settings Form -->
        <template v-if="canEdit">
          <SectionTitle>Edit Settings</SectionTitle>
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
                  @file-selected="handleLogoFileSelected"
                />
              </div>
            </UFormField>

            <!-- Logo Upload Progress -->
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
                  @file-selected="handleBgFileSelected"
                />
              </div>
            </UFormField>

            <!-- Background Upload Progress -->
            <div v-if="isBgUploading" class="space-y-1">
              <p class="text-xs text-center text-muted">Uploading background...</p>
              <UProgress :value="bgUpload.state.value.progress" size="xs" color="primary" />
            </div>

            <!-- Theme Color -->
            <UFormField label="Theme Color">
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="color in THEME_COLORS"
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
            <UFormField v-if="isOwnerOnly" label="Room Name">
              <UInput v-model="editName" placeholder="Enter room name" icon="i-lucide-type" size="lg" class="w-full" />
            </UFormField>

            <!-- Room Type (Owner Only) -->
            <UFormField v-if="isOwnerOnly" label="Room Type">
              <USelect v-model="editType" :items="typeOptions" value-key="value" size="lg" class="w-full" />
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

            <!-- Password (Owner Only) -->
            <template v-if="isOwnerOnly">
              <UFormField label="Set / Change Password">
                <UInput
                  v-model="editPassword"
                  :type="showSettingsPassword ? 'text' : 'password'"
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
                      :icon="showSettingsPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-label="showSettingsPassword ? 'Hide password' : 'Show password'"
                      :padded="false"
                      @click="() => {showSettingsPassword = !showSettingsPassword}"
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
                @click="handleRemovePassword"
              >
                Remove Password
              </UButton>
            </template>

            <!-- Blocked Users (Owner / Admin only) -->
            <div class="border-t border-neutral-700 pt-3">
              <UButton
                icon="i-lucide-ban"
                color="neutral"
                variant="subtle"
                size="lg"
                class="w-full justify-center"
                @click="showBlockList = true"
              >
                Blocked Users
              </UButton>
            </div>

            <!-- Play Music (Owner / Admin only) -->
            <div class="border-t border-neutral-700 pt-3">
              <UButton
                v-if="canPlayMusic"
                icon="i-lucide-music"
                color="primary"
                variant="subtle"
                size="lg"
                class="w-full justify-center"
                @click="openMusicPicker(false)"
              >
                Play Music
              </UButton>
              <template v-else>
                <p class="text-xs text-neutral-400 text-center">
                  Music is currently being played by another user.
                </p>
                <!-- Owner-only: force-take the live slot (admins cannot interrupt). -->
                <UButton
                  v-if="canForceTakeMusic"
                  icon="i-lucide-replace"
                  color="warning"
                  variant="subtle"
                  size="lg"
                  class="w-full justify-center mt-2"
                  @click="openMusicPicker(true)"
                >
                  Force Take Over
                </UButton>
              </template>
            </div>

            <!-- Save Button -->
            <UButton
              icon="i-lucide-save"
              color="primary"
              size="xl"
              class="w-full justify-center"
              :loading="saving"
              @click="handleSaveSettings"
            >
              Save Changes
            </UButton>
          </div>
        </template>

        <!-- Block List Drawer (triggered from Blocked Users button) -->
        <RoomBlockListDrawer
          v-if="thisRoom && canEdit"
          v-model:open="showBlockList"
          :room-id="thisRoom.id"
        />

        <!-- Audio File Picker (triggered from Play Music button) -->
        <RoomAudioPlayerUploader
          v-model:open="showMusicUploader"
          :is-loading="isMusicLoading"
          @files-selected="handleMusicFilesSelected"
        />

        <UButton color="neutral" variant="subtle" icon="i-lucide-x" class="justify-center mt-4" @click="() => {open = false}">
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
