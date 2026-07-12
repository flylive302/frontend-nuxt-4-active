import { DEFAULT_SEAT_COUNT } from '~/constants/room'

// ========================================
// Room Settings Form (Action composable)
// ========================================
//
// Shared GATE → EXECUTE → REACT pipeline behind the Theme and Privacy
// sub-drawers. Each drawer instantiates its own copy, binds only its
// field subset, and calls save() — the diff builder only PATCHes fields
// that actually changed, so unbound fields are no-ops.
// ========================================

export function useRoomSettingsForm() {
  const roomStore = useRoomStore()
  const { patchRoom, normalizeError } = useRoomSettingsApi()
  const { createUploadState } = useImageUpload()
  const toast = useToast()

  const thisRoom = computed(() => roomStore.currentRoom)

  // ---- Form state ----
  const editName = ref('')
  const editPassword = ref('')
  const editType = ref<'public' | 'private'>('public')
  const editColor = ref('')
  const editMaxSeats = ref(DEFAULT_SEAT_COUNT)
  const saving = ref(false)

  // ---- Image state (logo + background) ----
  const logoUpload = createUploadState()
  const logoPreview = ref<string | null>(null)
  const logoFile = ref<File | null>(null)
  const isLogoUploading = computed(() => logoUpload.state.value.status === 'uploading')

  const bgUpload = createUploadState()
  const bgPreview = ref<string | null>(null)
  const bgFile = ref<File | null>(null)
  const isBgUploading = computed(() => bgUpload.state.value.status === 'uploading')

  function selectLogoFile(file: File): void {
    logoFile.value = file
    if (logoPreview.value) URL.revokeObjectURL(logoPreview.value)
    logoPreview.value = URL.createObjectURL(file)
  }

  function selectBgFile(file: File): void {
    bgFile.value = file
    if (bgPreview.value) URL.revokeObjectURL(bgPreview.value)
    bgPreview.value = URL.createObjectURL(file)
  }

  /** Reset the form from the current room (call when a sub-drawer opens). */
  function syncFromRoom(): void {
    if (!thisRoom.value) return
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

  /** Release preview object URLs (call on unmount). */
  function releasePreviews(): void {
    if (logoPreview.value && logoFile.value) URL.revokeObjectURL(logoPreview.value)
    if (bgPreview.value && bgFile.value) URL.revokeObjectURL(bgPreview.value)
  }

  /** Save changed fields. Returns true on success. */
  async function save(): Promise<boolean> {
    // GATE
    if (!thisRoom.value || saving.value) return false

    saving.value = true
    try {
      // EXECUTE — build diff, upload images, PATCH
      const body = buildDiff()

      if (logoFile.value) {
        const ok = await uploadImage(logoUpload, logoFile.value, body, 'logo_url', 'logo_file_id', 'logo')
        if (!ok) return false
      }
      if (bgFile.value) {
        const ok = await uploadImage(bgUpload, bgFile.value, body, 'background_url', 'background_file_id', 'background')
        if (!ok) return false
      }

      if (Object.keys(body).length === 0) {
        toast.add({ title: 'No Changes', description: 'Nothing to update.', color: 'info' })
        return false
      }

      const response = await patchRoom(thisRoom.value.id, body)
      if (response.data && thisRoom.value) {
        Object.assign(thisRoom.value, response.data)
      }

      // REACT
      toast.add({ title: 'Settings Saved', description: 'Room settings updated.', color: 'success' })
      logoFile.value = null
      bgFile.value = null
      return true
    } catch (err) {
      toast.add({ title: 'Error', description: normalizeError(err).message, color: 'error' })
      return false
    } finally {
      saving.value = false
    }
  }

  /** Remove password protection (owner-only instant action). */
  async function removePassword(): Promise<void> {
    // GATE
    if (!thisRoom.value || saving.value) return

    saving.value = true
    try {
      // EXECUTE
      const response = await patchRoom(thisRoom.value.id, { password: '' })
      if (response.data && thisRoom.value) {
        Object.assign(thisRoom.value, response.data)
      }
      // REACT
      toast.add({ title: 'Password Removed', description: 'Room is no longer password protected.', color: 'success' })
    } catch (err) {
      toast.add({ title: 'Error', description: normalizeError(err).message, color: 'error' })
    } finally {
      saving.value = false
    }
  }

  // ---- Private stage helpers ----

  function buildDiff(): Record<string, unknown> {
    const room = thisRoom.value
    const body: Record<string, unknown> = {}
    if (!room) return body
    if (editName.value && editName.value !== room.name) body.name = editName.value
    if (editPassword.value) body.password = editPassword.value
    if (editType.value !== (room.is_private ? 'private' : 'public')) body.type = editType.value
    if (editColor.value && editColor.value !== room.primary_color) body.primary_color = editColor.value
    if (editMaxSeats.value !== room.max_seats) body.max_seats = editMaxSeats.value
    return body
  }

  async function uploadImage(
    uploadState: ReturnType<typeof createUploadState>,
    file: File,
    body: Record<string, unknown>,
    urlKey: string,
    fileIdKey: string,
    label: string
  ): Promise<boolean> {
    const result = await uploadState.upload(file, 'rooms')
    if (!result || !result.url) {
      toast.add({ title: 'Upload Failed', description: `Failed to upload ${label}.`, color: 'error' })
      return false
    }
    body[urlKey] = result.url
    body[fileIdKey] = result.fileId
    return true
  }

  return {
    thisRoom,
    // form state
    editName,
    editPassword,
    editType,
    editColor,
    editMaxSeats,
    saving,
    // images
    logoUpload,
    logoPreview,
    isLogoUploading,
    selectLogoFile,
    bgUpload,
    bgPreview,
    isBgUploading,
    selectBgFile,
    // pipeline
    syncFromRoom,
    releasePreviews,
    save,
    removePassword,
  }
}
