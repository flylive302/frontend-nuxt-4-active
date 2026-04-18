<script setup lang="ts">

interface Room {
    id: number;
    name: string;
    logo: string;
    background: string;
    primary_color: string;
    country: string;
    room_xp: number;
    current_level: number;
    is_live: boolean;
    participant_count: number;
    is_locked: boolean;
}

const props = defineProps(["room"]);
</script>

<template>
    <article class="relative rounded-3xl squircle overflow-hidden min-h-54">
        <figure class="h-full w-full">
            <NuxtImg
                :src="props.room.background"
                :alt="props.room.name"
                width="250"
                class="size-full object-cover"
                format="webp"
                densities="x1 x2"
            />
            <figcaption class="sr-only">{{ props.room.name }}</figcaption>
        </figure>

        <!-- Overlay content -->
        <aside class="absolute inset-0 px-4 pb-1 flex items-end bg-gradient-to-t from-black/80 to-transparent">
            <div class="flex justify-between w-full pb-2">
                <!-- Text -->
                <p class="text-sm max-w-16 leading-none w-full">
                    {{ props.room.name }}
                </p>

                <div class="flex items-end justify-end gap-1 w-20">
                    <!-- Live dot -->
                    <span class="relative inline-flex pb-1">
                        <span class="absolute inline-block size-2 rounded-full bg-success animate-ping"/>
                        <span class="relative inline-block size-2 rounded-full bg-success"/>
                    </span>
                    <p class="text-sm leading-none">
                        {{ props.room.participant_count }}
                    </p>
                </div>
            </div>
        </aside>

        <!-- Password lock indicator (top-right) -->
        <div v-if="props.room.is_locked" class="absolute top-2 right-2">
            <UIcon name="i-lucide-lock" class="size-4 text-warning drop-shadow-lg" />
        </div>
    </article>
</template>