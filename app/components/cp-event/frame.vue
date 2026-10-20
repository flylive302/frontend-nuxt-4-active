<script setup lang="ts">
import type { CpUserCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'
import { cpFrameId } from '~/utils/cp'

// Avatar with the CP ring frame. The frame prop id is picked client-side by
// gender (bootstrap `cp.frame_male` / `frame_female`).
//  - default: STATIC ring (cached still of the SVGA's first frame) — for lists
//  - `animated`: live SVGA, mounted only while on-screen (profile hero only;
//    the caller decides tier/switch eligibility)

const props = withDefaults(defineProps<{
  user: CpUserCard
  animated?: boolean
}>(), {
  animated: false,
})

const bootstrapStore = useBootstrapStore()

const frameId = computed(() => cpFrameId(props.user, bootstrapStore.cpConfig))
</script>

<template>
  <UserAvatar
    :img="user.avatar"
    :user-name="user.name"
    :frame-id="frameId"
    :frame-image-url="frameId === null ? ASSETS.CP_RANK_FRAME : undefined"
    :animated="animated"
    :defer-frame-animation="animated"
    :static-frame="!animated"
  />
</template>
