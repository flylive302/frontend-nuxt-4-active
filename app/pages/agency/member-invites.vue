<script setup lang="ts">
definePageMeta({ layout: 'alt' })
</script>

<template>
  <div>
    <NavAlt back-to="/agency/owner">Sent Member Invites</NavAlt>
    <div class="flex flex-col gap-3 px-3 my-14">
      <AgencyMemberRequestCard
          name="Alia Butt"
          charm-badge="2"
          wealth-badge="1"
          frame-name="/frames/17"
          :frame-girth="50"
          img="/avatars/placeholder"
          gender="male"
      />
      <AgencyMemberRequestCard
          name="Rana Haseeb"
          charm-badge="12"
          wealth-badge="11"
          frame-name="/frames/admin/admin"
          :frame-girth="48"
          img="/avatars/placeholder"
          gender="female"
      />
      <AgencyMemberRequestCard
          name="Butt Saab"
          charm-badge="12"
          wealth-badge="11"
          frame-name="/frames/admin/bd"
          :frame-girth="48"
          img="/avatars/placeholder"
          gender="others"
      />
      <AgencyMemberRequestCard
          name="Darwaish Saab"
          charm-badge="12"
          wealth-badge="11"
          frame-name="/frames/admin/cs_leader"
          :frame-girth="45"
          img="/avatars/placeholder"
          gender="male"
      />
    </div>
  </div>
</template>