<script setup lang="ts">
import { NuxtLink } from '#components'
import { presenceLabel } from '~/utils/dm-thread-view'

const props = withDefaults(
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
    /** dm-messenger-v2/07: participant's last-activity timestamp, for the "Last seen …" fallback. */
    lastSeenAt?: string | null
  }>(),
  { fixed: true, lastSeenAt: null },
)

defineEmits<{
  (e: 'block' | 'deleteChat' | 'report' | 'back'): void
}>()

// dm-messenger-v2/07: "Online" wins; otherwise "Last seen …" from lastSeenAt,
// or nothing when neither is known (graceful fallback).
const presence = computed(() => presenceLabel(props.online ?? false, props.lastSeenAt ?? null))

// Avatar/name tap → the participant's public profile (signature-keyed route).
// System threads and participants without a signature render a plain div.
const profileTo = computed(() => (!props.isSystem && props.signature ? `/profile/${props.signature}` : null))
</script>

<template>
  <header
    class="top-0 inset-x-0 z-40 box-content flex items-center gap-3 px-3 h-14 bg-default/90 backdrop-blur border-b border-muted/20"
    :class="fixed ? 'fixed safe-area-top' : 'relative shrink-0'"
  >
    <UButton
      variant="ghost"
      icon="i-lucide-arrow-left"
      size="sm"
      class="-ml-1"
      @click="$emit('back')"
    />

    <!-- Avatar + Name (tap → public profile when available) -->
    <component
      :is="profileTo ? NuxtLink : 'div'"
      :to="profileTo ?? undefined"
      class="flex items-center gap-3 flex-1 min-w-0"
    >
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
          class="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-success ring-2 ring-default"
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
        <p
          v-if="!isSystem && presence"
          class="text-[11px] truncate"
          :class="online ? 'text-success' : 'text-muted'"
        >
          {{ presence }}
        </p>
        <ProfileBadge v-else-if="signature" :txt="signature" />
      </div>
    </component>

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
