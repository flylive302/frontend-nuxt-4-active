<script setup lang="ts">
/**
 * A Pretty ID signature on the gold crowned plate (profile page only).
 * Presentational: <ProfileBadge> owns copy-on-tap and the "Copied!" hint.
 * `<PrettyIdTheme>` supplies the event tokens + frame art the badge reads.
 * The number scales with the plate (container query unit), so it fits any width.
 */
defineProps<{
  txt: string
}>()
</script>

<template>
  <PrettyIdTheme class="profile-plate">
    <PrettyIdBadge :id="txt" width="100%" font-size="14cqw" />
  </PrettyIdTheme>
</template>

<style scoped>
.profile-plate {
  container-type: inline-size;
}
</style>
