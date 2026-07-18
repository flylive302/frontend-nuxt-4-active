<script setup lang="ts">
definePageMeta({ layout: 'alt', middleware: 'auth' })

const route = useRoute()
const threadId = computed(() => route.params.threadId as string)

const { stop: stopPresence } = useDmPresence()
onBeforeUnmount(() => {
  stopPresence()
})

async function handleExit(): Promise<void> {
  await navigateTo('/inbox', { replace: true })
}
</script>

<template>
  <main class="flex flex-col h-dvh overflow-hidden">
    <InboxThreadPanel :thread-id="threadId" fixed-header @exit="handleExit" />
  </main>
</template>
