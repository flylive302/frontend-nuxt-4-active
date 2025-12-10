<script setup lang="ts">
definePageMeta({ layout: 'alt' })

const items = [
  {
    label: 'Achievement Badges',
    slot: 'achievement'
  },
  {
    label: 'Activity Badges',
    slot: 'activity'
  },
]
</script>

<template>
  <main>
    <NavAlt color="secondary" back-to="/profile" :linked="true" first-link="/badges/" second-link="/badges/my-badges">
      <template #first-link-text>Badges</template>
      <template #second-link-text>My Badges</template>
    </NavAlt>

    <div class="px-3 mt-6 mb-32 overflow-hidden">
      <UTabs
          color="neutral"
          size="sm" class="mt-6"
          :ui="{
              trigger: '!text-white !font-bold data-[state=active]:border border-secondary data-[state=active]:bg-gradient-to-br to-secondary/50',
              list: 'bg-transparent',
          }"
          :items="items"
      >
        <template #achievement>
          <div class="grid grid-cols-2 gap-2">
            <CardProps />
            <CardProps />
            <CardProps />
            <CardProps />
            <CardProps />
            <CardProps />
          </div>
        </template>

        <template #activity>
          <div class="grid grid-cols-2 gap-2">
            <CardProps />
            <CardProps />
            <CardProps />
          </div>
        </template>
      </UTabs>
    </div>

  </main>
</template>

<style scoped>

</style>