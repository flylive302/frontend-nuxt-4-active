<script setup lang="ts">
import type { TabsItem } from '@nuxt/ui'

const items: TabsItem[] = [
  {
    label: 'Daily',
  },
  {
    label: 'Weekly',
  },
  {
    label: 'Monthly',
  }
]
</script>

<template>
  <div class="flex justify-between items-center my-1">
    <UDrawer direction="left">
      <UButton
          variant="subtle"
          icon="i-lucide-coins"
          size="xs"
          class="cursor-pointer shadow-md backdrop-blur-xs font-bold"
      >
        11.3 M
      </UButton>

      <template #content>
        <div class="mt-2 pl-1 min-w-11/12">
          <div class="flex items-baseline justify-between">
            <SectionTitle>Room Activity</SectionTitle>
            <UButton
                variant="soft"
                icon="i-lucide-coins"
                size="xs"
                class="cursor-pointer text-primary shadow-md backdrop-blur-xs font-bold"
            >
              11.3 M
            </UButton>
          </div>

          <UTabs :items="items" variant="link" :ui="{ trigger: 'grow' }" class="w-full h-full">
            <template #content="{ item }">
              <div class="p-2 h-[84vh] bg-neutral-800 rounded-lg inset-shadow-sm inset-shadow-neutral-700 space-y-3 overflow-y-scroll">

                <div class="flex items-center justify-between w-full">
                  <UBadge color="primary" class="text-white font-bold" label="1"/>
                  <div class="flex gap-1 bg-gradient-to-br to-primary/40 border-2 border-primary rounded-lg shadow-md shadow-primary/50 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" variant="soft" icon="i-lucide-coins">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge color="secondary" class="text-white font-bold" label="2"/>
                  <div class="flex gap-1 bg-gradient-to-br to-secondary/40 border-2 border-secondary rounded-lg shadow-md shadow-secondary/50 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" color="secondary" variant="soft" icon="i-lucide-coins">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge color="tertiary" class="text-white font-bold" label="3"/>
                  <div class="flex gap-1 bg-gradient-to-br to-tertiary/40 border-2 border-tertiary rounded-lg shadow-md shadow-tertiary/50 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" color="tertiary" variant="soft" icon="i-lucide-coins">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge class="text-white font-bold bg-neutral-700" label="4"/>
                  <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" variant="soft" icon="i-lucide-coins" class="bg-default">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge class="text-white font-bold bg-neutral-700" label="4"/>
                  <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" variant="soft" icon="i-lucide-coins" class="bg-default">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge class="text-white font-bold bg-neutral-700" label="4"/>
                  <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" variant="soft" icon="i-lucide-coins" class="bg-default">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge class="text-white font-bold bg-neutral-700" label="4"/>
                  <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" variant="soft" icon="i-lucide-coins" class="bg-default">5.2 M</UButton>
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between w-full">
                  <UBadge class="text-white font-bold bg-neutral-700" label="4"/>
                  <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
                    <Avatar animated class="w-14"/>
                    <div class="flex flex-col justify-center min-h-full">
                      <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                      <div class="flex items-center gap-1 mt-1">
                        <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                        <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                      </div>
                    </div>

                    <div class="flex flex-col justify-center min-h-full">
                      <UButton size="xs" variant="soft" icon="i-lucide-coins" class="bg-default">5.2 M</UButton>
                    </div>
                  </div>
                </div>

              </div>
            </template>
          </UTabs>

        </div>
      </template>
    </UDrawer>


    <UDrawer direction="right">
      <UButton
          variant="subtle"
          icon="i-lucide-users-round"
          size="xs"
          class="cursor-pointer shadow-md backdrop-blur-xs font-bold"
      >
        95
      </UButton>

      <template #content>
        <div class="min-w-11/12 pr-2">
          <SectionTitle class="my-3">User Active in Room</SectionTitle>
          <div class="p-2 h-[90vh] bg-neutral-800 rounded-lg inset-shadow-sm inset-shadow-neutral-700 space-y-3 overflow-y-scroll">

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

            <div class="flex gap-1 bg-gradient-to-bl to-neutral-950 border-2 border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden">
              <Avatar animated class="w-13"/>
              <div class="flex flex-col justify-center min-h-full">
                <h3 class="text-sm font-bold leading-tight">User Name <icon name="i-lucide-mars" /></h3>
                <div class="flex items-center gap-1">
                  <ProfileBadge />
                  <ProfileBadge badge-src="/siteAssets/badges/badge-wealth-level-3.webp" color="tertiary" txt="1"/>
                  <ProfileBadge badge-src="/siteAssets/badges/badge-charm-level-3.webp" color="secondary" txt="2"/>
                </div>
              </div>
            </div>

          </div>
        </div>
      </template>
    </UDrawer>
  </div>
</template>

<style scoped>

</style>