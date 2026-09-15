<!-- ~/components/agency/income/InProgressNote.vue -->
<!-- Generic note shown while a run/cycle is still open: reseller payments for
     it aren't final yet. Reused by both the owner cycle view and the member
     run view — no props, no run-specific wording. -->
<template>
  <UAlert
    color="info"
    variant="soft"
    icon="i-lucide-info"
    title="Run in progress — reseller payments for this run are counted after it ends."
  />
</template>
