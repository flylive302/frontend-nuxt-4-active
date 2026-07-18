<script setup lang="ts">
withDefaults(
  defineProps<{
    name: string
    avatar?: string | null
    frame?: string | null
    signature?: string | null
    gender?: number | null
    isSystem?: boolean
    /** Full page pins the header with `position: fixed`; a drawer contains it in-flow instead. */
    fixed?: boolean
    /** dm-realtime-platform/07: presence dot on the avatar. */
    online?: boolean
  }>(),
  { fixed: true },
)

defineEmits<{
  (e: 'block' | 'deleteChat' | 'report' | 'back'): void
}>()
</script>

<template>
  <header
    class="top-0 inset-x-0 z-40 safe-area-top box-content flex items-center gap-3 px-3 h-14 bg-default/90 backdrop-blur border-b border-muted/20"
    :class="fixed ? 'fixed' : 'relative shrink-0'"
  >
    <UButton
      variant="ghost"
      icon="i-lucide-arrow-left"
      size="sm"
      class="-ml-1"
      @click="$emit('back')"
    />

    <!-- Avatar / Icon -->
    <div class="relative shrink-0">
      <div
        v-if="isSystem"
        class="size-9 rounded-full bg-primary/15 flex items-center justify-center"
      >
        <UIcon name="i-lucide-shield-check" class="size-5 text-primary" />
      </div>
      <UserAvatar v-else :img="avatar" :frame-asset-url="frame ?? undefined" animated class="size-12" />
      <span
        v-if="!isSystem && online"
        class="absolute bottom-0 right-0 size-3 rounded-full bg-success ring-2 ring-default"
        aria-label="Online"
      />
    </div>

    <!-- Name + Signature + Gender -->
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-1.5">
        <span class="text-sm font-semibold truncate">{{ name }}</span>
        <UIcon
          v-if="gender === 1"
          name="i-lucide-mars"
          class="size-3.5 text-blue-400 shrink-0"
        />
        <UIcon
          v-else-if="gender === 2"
          name="i-lucide-venus"
          class="size-3.5 text-pink-400 shrink-0"
        />
      </div>
      <ProfileBadge v-if="signature" :txt="signature" />
    </div>

    <!-- Actions menu -->
    <UDropdownMenu
      v-if="!isSystem"
      :items="[
        [
          { label: 'Report User', icon: 'i-lucide-flag', color: 'error' as const, onSelect: () => $emit('report') },
          { label: 'Block User', icon: 'i-lucide-ban', color: 'error' as const, onSelect: () => $emit('block') },
          { label: 'Delete Chat', icon: 'i-lucide-trash-2', color: 'error' as const, onSelect: () => $emit('deleteChat') },
        ],
      ]"
    >
      <UButton variant="ghost" icon="i-lucide-ellipsis-vertical" size="sm" color="neutral" />
    </UDropdownMenu>
  </header>
</template>
