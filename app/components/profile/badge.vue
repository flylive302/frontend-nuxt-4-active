<script setup lang="ts">
import type { Colors } from '~/types/colors'

// ProfileBadge only supports a subset of colors
type BadgeColor = Extract<Colors, 'primary' | 'secondary' | 'tertiary' | 'success'>

withDefaults(defineProps<{
  color?: BadgeColor
  badgeSrc?: string
  txt?: string | number
  imgAlt?: string
  showBadge?: boolean
}>(), {
  color: "primary",
  badgeSrc: "https://ik.imagekit.io/flylive/badges/profile-1.webp",
  txt: "UserSignature",
  imgAlt: "User badge",
  showBadge: true,
})

// Tailwind-safe variants
const variantMap: Record<BadgeColor, string> = {
  primary:   "bg-primary/30   border-primary/70",
  secondary: "bg-secondary/30 border-secondary/70",
  tertiary:  "bg-tertiary/30  border-tertiary/70",
  success:   "bg-success/30   border-success/70",
}

</script>

<template>
  <div class="flex items-center w-fit">
    <NuxtImg
        v-if="showBadge"
        :src="badgeSrc"
        :alt="imgAlt"
        class="w-6 relative z-10 shrink-0"
        :width="64"
        :height="64"
        format="webp"
        densities="x1 x2"
        sizes="64px"
        loading="lazy"
    />
    <p
        class="font-semibold border-2 rounded-full shadow-md backdrop-blur-md text-xs pr-1  truncate"
        :class="[
          variantMap?.[color],
          showBadge ? 'pl-4 -ml-4' : 'pl-1 m-0'
        ]"
    >
      {{ txt }}
    </p>
  </div>
</template>
