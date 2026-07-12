<script setup lang="ts">
// ========================================
// Room Settings Drawer (Hub)
// ========================================
//
// Grid of role-filtered buttons opening sub-drawers:
// - Members   → RoomMembersPanel (everyone)
// - Theme     → RoomSettingsThemeDrawer (owner/admin)
// - Privacy   → RoomSettingsPrivacyDrawer (owner only)
// - Block List→ RoomBlockListDrawer (owner/admin)
// - Music     → RoomAudioPlayerUploader (owner/admin; force-take owner only)
// - Gift Mute / Entry Mute → in-place per-device FX toggles (everyone)
// ========================================

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })

const showMembers = ref(false)
const showTheme = ref(false)
const showPrivacy = ref(false)
const showBlockList = ref(false)

// ========================================
// Stores & Composables
// ========================================

const roomStore = useRoomStore()
const fxPrefs = useFxPreferencesStore()
const { socket } = useAudioSocket()
const { canEdit, isRoomOwner, refresh } = useRoomMembershipState(
  () => roomStore.currentRoom?.id ?? null
)
const {
  showUploader: showMusicUploader,
  isLoading: isMusicLoading,
  canPlayMusic,
  canForceTakeMusic,
  openPicker: openMusicPicker,
  handleFilesSelected: handleMusicFilesSelected,
} = useRoomMusicLaunch(socket)

// ========================================
// Computed
// ========================================

const thisRoom = computed(() => roomStore.currentRoom)

/** Music button is unusable only for non-owner editors while another DJ holds the slot. */
const isMusicLocked = computed(() => !canPlayMusic.value && !canForceTakeMusic.value)

// ========================================
// Handlers
// ========================================

function handleMusicClick(): void {
  if (isMusicLocked.value) return
  openMusicPicker(canForceTakeMusic.value)
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  refresh()
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
        <div class="grid grid-cols-3 gap-3">
          <!-- Members (everyone) -->
          <button
            type="button"
            class="aspect-square rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
            @click="showMembers = true"
          >
            <UIcon name="i-lucide-users" class="size-7 text-primary" />
            <span class="text-xs text-neutral-200">Members</span>
          </button>

          <!-- Theme (owner / admin) -->
          <button
            v-if="canEdit"
            type="button"
            class="aspect-square rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
            @click="showTheme = true"
          >
            <UIcon name="i-lucide-palette" class="size-7 text-primary" />
            <span class="text-xs text-neutral-200">Theme</span>
          </button>

          <!-- Privacy (owner only) -->
          <button
            v-if="isRoomOwner"
            type="button"
            class="aspect-square rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
            @click="showPrivacy = true"
          >
            <UIcon name="i-lucide-shield" class="size-7 text-primary" />
            <span class="text-xs text-neutral-200">Privacy</span>
          </button>

          <!-- Block List (owner / admin) -->
          <button
            v-if="canEdit"
            type="button"
            class="aspect-square rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
            @click="showBlockList = true"
          >
            <UIcon name="i-lucide-ban" class="size-7 text-primary" />
            <span class="text-xs text-neutral-200">Block List</span>
          </button>

          <!-- Music (owner / admin; disabled for admins while another DJ is live) -->
          <button
            v-if="canEdit"
            type="button"
            class="aspect-square rounded-xl bg-neutral-800 transition-colors flex flex-col items-center justify-center gap-2"
            :class="isMusicLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-neutral-700 cursor-pointer'"
            :disabled="isMusicLocked"
            @click="handleMusicClick"
          >
            <UIcon
              :name="canForceTakeMusic ? 'i-lucide-replace' : 'i-lucide-music'"
              class="size-7"
              :class="canForceTakeMusic ? 'text-warning' : 'text-primary'"
            />
            <span class="text-xs text-neutral-200">
              {{ canForceTakeMusic ? 'Take Over' : isMusicLocked ? 'In Use' : 'Music' }}
            </span>
          </button>

          <!-- Gift Mute (everyone; in-place toggle, highlighted when active) -->
          <button
            type="button"
            class="aspect-square rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
            :class="fxPrefs.muteGiftAnimations
              ? 'bg-primary/20 ring-2 ring-primary'
              : 'bg-neutral-800 hover:bg-neutral-700'"
            :aria-pressed="fxPrefs.muteGiftAnimations"
            @click="fxPrefs.toggleGiftMute"
          >
            <UIcon
              name="i-lucide-gift"
              class="size-7"
              :class="fxPrefs.muteGiftAnimations ? 'text-primary' : 'text-neutral-400'"
            />
            <span class="text-xs" :class="fxPrefs.muteGiftAnimations ? 'text-primary' : 'text-neutral-200'">
              {{ fxPrefs.muteGiftAnimations ? 'Gifts Muted' : 'Gift Mute' }}
            </span>
          </button>

          <!-- Entry Mute (everyone; in-place toggle, highlighted when active) -->
          <button
            type="button"
            class="aspect-square rounded-xl transition-colors cursor-pointer flex flex-col items-center justify-center gap-2"
            :class="fxPrefs.muteEntryAnimations
              ? 'bg-primary/20 ring-2 ring-primary'
              : 'bg-neutral-800 hover:bg-neutral-700'"
            :aria-pressed="fxPrefs.muteEntryAnimations"
            @click="fxPrefs.toggleEntryMute"
          >
            <UIcon
              name="i-lucide-door-closed"
              class="size-7"
              :class="fxPrefs.muteEntryAnimations ? 'text-primary' : 'text-neutral-400'"
            />
            <span class="text-xs" :class="fxPrefs.muteEntryAnimations ? 'text-primary' : 'text-neutral-200'">
              {{ fxPrefs.muteEntryAnimations ? 'Entries Muted' : 'Entry Mute' }}
            </span>
          </button>
        </div>

        <!-- Sub-drawers -->
        <RoomMembersPanel
          v-model:open="showMembers"
          :room-id="thisRoom?.id ?? 0"
          style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
        />

        <RoomSettingsThemeDrawer v-if="canEdit" v-model:open="showTheme" />

        <RoomSettingsPrivacyDrawer v-if="isRoomOwner" v-model:open="showPrivacy" />

        <RoomBlockListDrawer
          v-if="thisRoom && canEdit"
          v-model:open="showBlockList"
          :room-id="thisRoom.id"
        />

        <RoomAudioPlayerUploader
          v-model:open="showMusicUploader"
          :is-loading="isMusicLoading"
          @files-selected="handleMusicFilesSelected"
        />

        <UButton color="neutral" variant="subtle" icon="i-lucide-x" class="justify-center mt-4" @click="() => { open = false }">
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
