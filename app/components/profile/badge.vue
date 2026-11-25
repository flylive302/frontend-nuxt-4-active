<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { withImageKitTransform } from '~/utils/imagekit'
import { showsPrettyIdPlate } from '~/utils/pretty-id-plate'

const props = withDefaults(defineProps<{
  txt?: string | number
  vip?: number
  /** True while the user wears a Pretty ID or a Rare ID: the gold plate replaces the plain badge. */
  prettyIdPlate?: boolean
}>(), {
  txt: "UserSignature",
  vip: 0,
  prettyIdPlate: false,
})

const isPlate = computed(() => showsPrettyIdPlate(props.prettyIdPlate))

const source = computed(() => String(props.txt))
const { copy } = useClipboard({ source })

const showCopied = ref(false)
let hideTimer: ReturnType<typeof setTimeout> | null = null

async function onCopy() {
  await copy()
  showCopied.value = false
  await nextTick()
  showCopied.value = true
  if (hideTimer !== null) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { showCopied.value = false; hideTimer = null }, 800)
}

onBeforeUnmount(() => {
  if (hideTimer !== null) clearTimeout(hideTimer)
})
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
    <LazyProfileSignaturePlate
      v-if="isPlate"
      :txt="source"
      class="cursor-pointer select-none"
      @click="onCopy()"
    />
    <div v-else-if="vip && vip > 11" class="relative flex items-center justify-center cursor-pointer select-none" @click="onCopy()">
      <img :src="withImageKitTransform(`https://ik.imagekit.io/flylive/vip/${vip}/pretty_id.png`, { w: 208 })" class="min-w-26" alt="">
      <p class="absolute z-20 top-0 text-xs ml-6 mt-3 font-extrabold">{{txt}}</p>
    </div>

    <p v-else class="font-semibold border-2 bg-primary/60 border-primary rounded-full shadow-md text-xs px-1 cursor-pointer select-none text-center" @click="onCopy()">
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
