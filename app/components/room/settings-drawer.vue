<script setup lang="ts">
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
const { requestToJoin, cancelJoinRequest, fetchMyJoinRequests, myJoinRequests } = useRoomJoinRequests()
const { acceptInvitation, declineInvitation, receivedInvitations, fetchReceivedInvitations } = useRoomInvitations()
const { myMembership, fetchMyMembership, leaveRoomMembership } = useRoomMembers()
const { patchRoom, normalizeError } = useRoomSettingsApi()
const { createUploadState } = useImageUpload()
const { socket } = useAudioSocket()
const toast = useToast()

// Music player (restricted to canEdit users)
const {
  playerState: musicPlayerState,
  isMusicPlayingInRoom,
  loadFile: loadMusicFile,
  play: playMusic,
} = useRoomAudioPlayer(socket)
const { produceTrack, stopMusicProducer: _stopMusicProducer } = useMediasoupStreaming(socket)

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

const pendingInvitationId = computed(() => {
  if (!thisRoom.value) return undefined
  const roomId = thisRoom.value.id
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room_id === roomId || inv.room?.id === roomId) && inv.status === 'pending'
  )
  return pendingInvite?.id
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
const isMusicLoading = ref(false)

/** True when no music is playing or this user is the current music player. */
const canPlayMusic = computed(() =>
  !isMusicPlayingInRoom.value || musicPlayerState.userId === authStore.user?.id
)

const currentRoomId = computed(() => roomStore.currentRoom?.id?.toString() ?? '')

/**
 * Load the selected audio file and start streaming it to all room participants.
 */
async function handleMusicFileSelected(file: File): Promise<void> {
  isMusicLoading.value = true
  try {
    await loadMusicFile(file)
    showMusicUploader.value = false
    await handleMusicPlay()
  } catch {
    toast.add({ title: 'Music Error', description: 'Failed to load audio file.', color: 'error' })
  } finally {
    isMusicLoading.value = false
  }
}

/**
 * Acquire the MSAB music mutex and produce the audio track via mediasoup.
 */
async function handleMusicPlay(): Promise<void> {
  if (!currentRoomId.value) return
  const track = await playMusic(currentRoomId.value)
  if (!track) return
  await produceTrack(track)
}

// ========================================
// Form State (Owner Only)
// ========================================

const editName = ref('')
const editPassword = ref('')
const editType = ref<'public' | 'private'>('public')
const editColor = ref('')
const editMaxSeats = ref(15)
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
    editMaxSeats.value = thisRoom.value.max_seats ?? 15
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

const seatOptions = [5, 10, 15].map((n) => ({
  label: `${n} seats`,
  value: n,
}))

// ========================================
// Action Loading
// ========================================

const actionLoading = ref(false)

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
// Handlers — Membership Actions
// ========================================

async function handleRequestToJoin() {
  if (!thisRoom.value) return
  actionLoading.value = true
  await requestToJoin(thisRoom.value.id)
  actionLoading.value = false
}

async function handleCancelRequest() {
  if (!thisRoom.value) return
  actionLoading.value = true
  await cancelJoinRequest(thisRoom.value.id)
  actionLoading.value = false
}

async function handleAcceptInvitation() {
  if (!pendingInvitationId.value) return
  actionLoading.value = true
  await acceptInvitation(pendingInvitationId.value)
  actionLoading.value = false
  open.value = false
}

async function handleDeclineInvitation() {
  if (!pendingInvitationId.value) return
  actionLoading.value = true
  await declineInvitation(pendingInvitationId.value)
  actionLoading.value = false
}

async function handleLeaveRoom() {
  if (!thisRoom.value?.id) return
  actionLoading.value = true
  const success = await leaveRoomMembership(thisRoom.value.id)
  actionLoading.value = false
  if (success) {
    open.value = false
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

            <!-- Max Seats -->
            <UFormField label="Max Seats">
              <USelect v-model="editMaxSeats" :items="seatOptions" value-key="value" size="lg" class="w-full" />
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
                      @click="showSettingsPassword = !showSettingsPassword"
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

            <!-- Play Music (Owner / Admin only) -->
            <div class="border-t border-neutral-700 pt-3">
              <UButton
                v-if="canPlayMusic"
                icon="i-lucide-music"
                color="primary"
                variant="subtle"
                size="lg"
                class="w-full justify-center"
                @click="showMusicUploader = true"
              >
                Play Music
              </UButton>
              <p v-else class="text-xs text-neutral-400 text-center">
                Music is currently being played by another user.
              </p>
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

        <!-- Audio File Picker (triggered from Play Music button) -->
        <RoomAudioPlayerUploader
          v-model:open="showMusicUploader"
          :is-loading="isMusicLoading"
          @file-selected="handleMusicFileSelected"
        />

        <!-- Membership Actions -->
        <SectionTitle>Membership</SectionTitle>

        <template v-if="membershipState === 'none'">
          <UButton color="info" icon="i-lucide-user-plus" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleRequestToJoin">
            Request to Join
          </UButton>
        </template>

        <template v-else-if="membershipState === 'pending_request'">
          <p class="text-sm text-muted text-center">Your request is awaiting approval.</p>
          <UButton icon="i-lucide-x" color="warning" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleCancelRequest">
            Cancel Request
          </UButton>
        </template>

        <template v-else-if="membershipState === 'has_invitation'">
          <p class="text-sm text-muted text-center mb-2">The room owner has invited you to join.</p>
          <div class="flex gap-2">
            <UButton icon="i-lucide-check" color="success" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleAcceptInvitation">
              Accept
            </UButton>
            <UButton icon="i-lucide-x" color="error" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleDeclineInvitation">
              Decline
            </UButton>
          </div>
        </template>

        <template v-else-if="membershipState === 'member' || membershipState === 'admin'">
          <UButton icon="i-lucide-log-out" color="error" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleLeaveRoom">
            Leave Room
          </UButton>
        </template>

        <template v-else-if="membershipState === 'owner'">
          <p class="text-sm text-muted text-center">You are the room owner.</p>
        </template>

        <UButton color="neutral" variant="subtle" icon="i-lucide-x" class="justify-center mt-4" @click="open = false">
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
