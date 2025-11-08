<script setup lang="ts">
definePageMeta({ layout: 'alt' })

type AgencyApiResponse = {
  id: string
  name: string
  country: string
  countryCode: string
  avatar: string
  members: number
}

/** -------- Data Fetching -------- */
const {data} = await useFetch<AgencyApiResponse[]>('https://dummyjson.com/c/0f16-bb65-41ea-a7af')

</script>

<template>
  <main>
    <NavAlt back-to="/profile">All Agencies</NavAlt>
    <div class="px-3 pt-14">
      <AgencySearch />

      <div class="grid grid-cols-2 gap-3 mt-4">
        <Suspense fallback="loading" >
          <AgencyCard
              v-for="(item, index) in data"
              :id="item.id"
              :key="index"
              :name="item.name"
              :members="item.members"
              :country-code="item.countryCode.toLowerCase()"
              :avatar="item.avatar"
          />
        </Suspense>
      </div>
    </div>
  </main>
</template>