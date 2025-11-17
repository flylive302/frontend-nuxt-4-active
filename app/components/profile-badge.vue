<script setup lang="ts">
defineOptions({ name: "UserSignatureBadge" })

type Color = | "primary" | "secondary" | "tertiary" | "success"

withDefaults(defineProps<{
  color?: Color
  badgeSrc?: string
  txt?: string
  imgAlt?: string
  showBadge?: boolean
}>(), {
  color: "primary",
  badgeSrc: "/siteAssets/badges/badge-profile-1.webp",
  txt: "UserSignature",
  imgAlt: "User badge",
  showBadge: true,
})

// Tailwind-safe variants
const variantMap: Record<Color, string> = {
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
        provider="imagekit"
        :src="badgeSrc"
        :alt="imgAlt"
        class="w-7 relative z-10 shrink-0"
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
        role="note"
        :aria-label="txt"
    >
      {{ txt }}
    </p>
  </div>
</template>
