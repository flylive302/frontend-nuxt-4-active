<script setup lang="ts">
defineOptions({ name: "UserSignatureBadge" })

type Color = | "primary" | "secondary" | "tertiary" | "success"

withDefaults(defineProps<{
  color?: Color
  badgeSrc?: string
  txt?: string
  imgAlt?: string
}>(), {
  color: "primary",
  badgeSrc: "/badges/badge-profile-1.webp",
  txt: "UserSignature",
  imgAlt: "User badge"
})

// Tailwind-safe variants
const variantMap: Record<Color, string> = {
  primary:   "bg-primary/40   border-primary/70   text-primary-950",
  secondary: "bg-secondary/40 border-secondary/70 text-secondary-950",
  tertiary:  "bg-tertiary/40  border-tertiary/70  text-tertiary-950",
  success:   "bg-success/40   border-success/70   text-success-950",
}

</script>

<template>
  <div class="flex items-center w-fit">
    <NuxtImg
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
        class="font-semibold border-2 rounded-full shadow-md backdrop-blur-md text-sm pr-2 pl-5 -ml-4 truncate"
        :class="[variantMap[color]]"
        role="note"
        :aria-label="txt"
    >
      {{ txt }}
    </p>
  </div>
</template>
