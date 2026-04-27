<script setup lang="ts">
defineProps<{
  name: string
  avatar?: string | null
  frame?: string | null
  isSystem?: boolean
}>()

const router = useRouter()
</script>

<template>
  <header class="fixed top-0 inset-x-0 z-40 flex items-center gap-3 px-3 h-14 bg-default/90 backdrop-blur border-b border-muted/20">
    <UButton
      variant="ghost"
      icon="i-lucide-arrow-left"
      size="sm"
      class="-ml-1"
      @click="router.back()"
    />

    <!-- Avatar / Icon -->
    <div class="shrink-0">
      <div
        v-if="isSystem"
        class="size-9 rounded-full bg-primary/15 flex items-center justify-center"
      >
        <icon name="i-lucide-shield-check" class="size-5 text-primary" />
      </div>
      <UserAvatar v-else :img="avatar" :frame-asset-url="frame ?? undefined" class="size-9" />
    </div>

    <!-- Name -->
    <span class="text-sm font-semibold truncate flex-1">{{ name }}</span>
  </header>
</template>
