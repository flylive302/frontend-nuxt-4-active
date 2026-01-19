<script setup lang="ts">
import type {Room} from "~/types/room";
const roomStore = useRoomStore();

const props = defineProps<{
  room: Room
}>()

// Compute badge display based on room status
const badgeDisplay = computed(() => {
  if (!props.room.is_live) return null;
  return `Live / ${props.room.participant_count}`;
});

</script>

<template>
  <article class="relative overflow-hidden border border-white/50" @click="roomStore.setCurrentRoom(props.room)">
    <figure class="h-full w-full">
      <NuxtImg
          :src="props.room.logo ?? undefined"
          :alt="props.room.name ?? undefined"
          class="h-full w-full object-cover"
          preload
      />
      <figcaption class="sr-only">{{ props.room.name }}</figcaption>
    </figure>

    <!-- Overlay content -->
    <aside class="pointer-events-none absolute inset-0 p-3 flex items-end">
      <template v-if="badgeDisplay">
        <BgGlass
            frost-blur-radius="blur(4px)"
            rounded="rounded-full"
            class="flex items-center gap-1 px-1 w-fit rounded-full border border-white/60"
        >
          <!-- Live dot -->
          <span class="relative inline-flex">
              <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
              <span class="relative inline-block size-2 rounded-full bg-success"/>
            </span>

          <!-- Text -->
          <p class="text-sm font-semibold truncate">
            {{ props.room.name }} - {{ badgeDisplay }}
          </p>
        </BgGlass>
      </template>
      <!-- Show room name only if not live -->
      <template v-else>
        <BgGlass
            frost-blur-radius="blur(4px)"
            rounded="rounded-full"
            class="flex items-center gap-1 px-2 w-fit rounded-full border border-white/60"
        >
          <p class="text-sm font-semibold truncate">
            {{ props.room.name }}
          </p>
        </BgGlass>
      </template>
    </aside>
  </article>
</template>

