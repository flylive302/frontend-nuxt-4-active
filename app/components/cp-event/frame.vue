<script setup lang="ts">
import type { CpUserCard } from '~/types/cp'
import { ASSETS } from '~/constants/assets'
import { cpFrameId } from '~/utils/cp'

// Avatar with the CP ring frame — every CP surface (podium, list, self bar,
// CP profile, ferris wheel) renders users through this. The frame prop id is
// picked client-side by gender (bootstrap `cp.frame_male` / `frame_female`).
//  - default: STATIC ring (cached still of the SVGA's first frame) — for lists
//  - `animated`: live SVGA, mounted only while on-screen (profile hero only;
//    the caller decides tier/switch eligibility)
// Tapping it opens the user's public profile. preventDefault keeps an
// enclosing NuxtLink (profile cp-section) from navigating too; a deleted user
// (no signature) is not tappable.

const props = withDefaults(defineProps<{
  user: CpUserCard
  animated?: boolean
}>(), {
  animated: false,
})

const bootstrapStore = useBootstrapStore()

const frameId = computed(() => cpFrameId(props.user, bootstrapStore.cpConfig))

function openProfile(event: MouseEvent): void {
  if (!props.user.signature) return
  event.preventDefault()
  void navigateTo(`/profile/${props.user.signature}`)
}
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
    @click="openProfile"
  />
</template>
