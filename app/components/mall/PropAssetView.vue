<!-- ~/components/mall/PropAssetView.vue -->
<!-- Shared prop asset preview (frame / animation / room_theme / signature / fallback). -->
<!-- Used by PropDetailModal and MyPropDetailModal so the rendering lives in one place. -->
<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from '~/types/mall/prop'
import { PROP_TYPE_ICONS, PROP_TYPE_COLORS } from '~/constants/mall'
import { resolveMiceWaveRingColor } from '~/utils/mice-wave-ring-color'

defineOptions({ name: 'MallPropAssetView' })

const props = defineProps<{
  type: PropType
  name: string
  assetUrl: string
  thumbnailUrl: string
  signatureValue?: string | null
  avatarImg?: string
  /** Catalog prop id — resolves the frame's authored overlay geometry. */
  propId?: number | null
  /** `mice_wave` prop metadata (e.g. `{ color }`) — resolves the ring color. */
  metadata?: Record<string, unknown> | null
}>()

const icon = computed(() => PROP_TYPE_ICONS[props.type])
const iconColor = computed(() => PROP_TYPE_COLORS[props.type])

/** Ring color for the mice-wave preview — same resolver as the seat's speaking ring. */
const miceWaveRingColor = computed(() => resolveMiceWaveRingColor(props.metadata))
</script>

<template>
  <!-- Frame: UserAvatar with frame -->
  <template v-if="type === 'frame'">
    <UserAvatar
      :animated="true"
      :frame-id="propId"
      :frame-asset-url="assetUrl"
      :img="avatarImg"
    />
  </template>

  <!-- Mice wave: animated ring pulse (svga-removal 05, replaces SVGA preview) -->
  <!-- No `overflow-hidden` here (unlike the other type frames) — the pulse's -->
  <!-- box-shadow extends past the ring's own box and would get clipped. -->
  <template v-else-if="type === 'mice_wave'">
    <div class="w-full aspect-square bg-muted/20 rounded-xl flex items-center justify-center">
      <MiceWaveRing :color="miceWaveRingColor" :animated="true" />
    </div>
  </template>

  <!-- Animated props: animated asset (svga · vap · video · image) -->
  <template v-else-if="type === 'entry_animation' || type === 'chat_bubble' || type === 'data_card' || type === 'slides'">
    <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
      <AssetPlayer
        class="relative min-w-full z-10"
        :src="assetUrl"
        :thumbnail-src="thumbnailUrl || undefined"
        :muted="false"
      />
    </div>
  </template>

  <!-- Room Theme: thumbnail + asset images -->
  <template v-else-if="type === 'room_theme'">
    <div class="space-y-2">
      <img
        v-if="thumbnailUrl"
        :src="thumbnailUrl"
        :alt="name"
        class="w-full h-auto object-contain rounded-xl"
        referrerpolicy="no-referrer"
      >
      <img
        v-if="assetUrl"
        :src="assetUrl"
        :alt="name"
        class="w-full h-auto object-contain rounded-xl"
        referrerpolicy="no-referrer"
      >
    </div>
  </template>

  <!-- Signature / Unique ID: ProfileBadge -->
  <template v-else-if="type === 'signature'">
    <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
      <ProfileBadge :txt="String(signatureValue ?? name)" />
    </div>
  </template>

  <!-- Fallback: Icon -->
  <template v-else>
    <div class="aspect-square bg-muted/20 rounded-xl overflow-hidden flex items-center justify-center">
      <icon :name="icon" class="size-16" :class="iconColor" />
    </div>
  </template>
</template>
