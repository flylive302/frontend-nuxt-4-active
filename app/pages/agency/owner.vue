<script setup lang="ts">
definePageMeta({ layout: 'alt' })
</script>

<template>
  <main>
    <NavAlt back-to="/profile">My Agency</NavAlt>

    <AltHero class="z-20">
      <div class="flex flex-col justify-center min-h-[55vw] bg-gradient-to-br to-primary/30">
        <NuxtLink to="/agency/abc_agency" class="grid grid-cols-5 gap-2">
          <Avatar :animated="true" class="col-span-2" />
          <div class="col-span-3 pr-3 my-auto">
            <h1 class="text-lg font-bold underline">Agency Name</h1>
            <div class="flex justify-between w-full">
              <p class="text-base font-semibold">Country</p>
              <icon name="i-flag-ad-4x3" class="size-8 rounded overflow-hidden h-6 shadow-md shadow-primary/50" />
            </div>
            <div class="flex justify-between w-full">
              <p class="text-base font-semibold">Members</p>
              <p class="text-lg font-bold flex items-center gap-2"><icon class="size-6" name="i-lucide-users"/> 89</p>
            </div>
          </div>
        </NuxtLink>
      </div>
    </AltHero>
    <div class="relative w-full mt-2 z-30 grid grid-cols-3 text-sm text-center font-bold leading-none">
      <p><icon name="i-lucide-coins" /> 159K<br> Total Coins </p>
      <p><icon name="i-lucide-sparkles" /> 1<br> Level </p>
      <p><icon name="i-lucide-users" /> 48<br> Members </p>
    </div>
    <div class="px-3 mt-4 mb-24">
      <NavProfileItem to="/agency/income" icon="i-lucide-coins" txt="Agency Income" />
      <NavProfileItem to="/agency/member-list" icon="i-lucide-user-search" txt="Member List" />
      <NavProfileItem to="/agency/member-requests" icon="i-lucide-mail-warning" txt="Member Requests" />
      <NavProfileItem to="/agency/member-invites" icon="i-lucide-user-plus" txt="Member Invites" />
      <NavProfileItem to="/agency/leave-requests" icon="i-lucide-user-x" txt="Agency Leave Requests" />
      <NavProfileItem to="/agency/owner" icon="i-lucide-database-backup" txt="Agency Data Query" />
    </div>
  </main>
</template>