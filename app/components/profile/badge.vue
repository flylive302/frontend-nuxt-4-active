<script setup lang="ts">
import { useClipboard } from '@vueuse/core'

const props = withDefaults(defineProps<{
  txt?: string | number
}>(), {
  txt: "UserSignature",
})

const source = computed(() => String(props.txt))
const { copy } = useClipboard({ source })

const showCopied = ref(false)

async function onCopy() {
  await copy()
  showCopied.value = false
  await nextTick()
  showCopied.value = true
  setTimeout(() => { showCopied.value = false }, 800)
}
</script>

<template>
  <div class="relative inline-block">
    <Transition name="float-up">
      <span
        v-if="showCopied"
        class="absolute -top-5 left-2/2 -translate-x-1/2 text-sm text-white font-bold pointer-events-none whitespace-nowrap"
      >
        Copied!
      </span>
    </Transition>
    <p @click="onCopy()" class="font-semibold border-2 bg-primary/40 border-primary rounded-full shadow-md backdrop-blur-md text-xs px-1 truncate cursor-pointer select-none text-center">
      {{ txt }}
    </p>
  </div>
</template>

<style scoped>
.float-up-enter-active {
  animation: float-up 1.5s ease-out forwards;
}
.float-up-leave-active {
  display: none;
}

@keyframes float-up {
  0%   { opacity: 1; transform: translate(-50%, 0); }
  100% { opacity: 0; transform: translate(-50%, -12px); }
}
</style>
