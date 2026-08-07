<script setup lang="ts">
// `inheritAttrs: false` because this renders two roots (carousel + password
// modal) — matching `components/room/card.vue`.
defineOptions({ name: 'EventBanners', inheritAttrs: false })

const { banners } = useEventBanners()

// A banner may point at a room, which cannot be reached by a plain link — see
// useBannerActions. The prompt modal is mounted once, outside the carousel slot,
// so a password-protected room banner isn't a silent no-op.
const { enterRoom, showPasswordPrompt, pendingRoom, onPasswordSuccess } = useRoomEntry()
const { openBanner, opening } = useBannerActions(enterRoom)
</script>

<template>
  <UCarousel
      v-bind="$attrs"
      :autoplay="true"
      :items="banners"
      class-names
      :ui="{
        item: 'basis-3/4 transition duration-800 ease-in-out scale-90 [&.is-snapped]:scale-100 squircle'
      }"
  >
    <template #default="{ item }">
      <!-- `custom` is load-bearing: it stops RouterLink attaching its own click
           handler, which would otherwise navigate before openBanner can
           intercept a room destination. See useBannerActions. -->
      <NuxtLink v-slot="{ href, navigate }" :to="item.navigateTo" custom>
      <a
          :href="href"
          :aria-busy="opening"
          class="block"
          @click="openBanner(item.navigateTo, $event, navigate)"
      >
      <!-- Decorative banner background -->
      <img
          :src="item.banner"
          alt=""
          aria-hidden="true"
          width="360"
          height="120"
          class="h-full w-full rounded-lg"
          :class="opening && 'opacity-60'"
      >

      <!--    <NuxtLink class="relative bg-info" to="/recharge">-->
      <!--      &lt;!&ndash; Header &ndash;&gt;-->
      <!--      <header class="relative flex min-h-8 items-center justify-center">-->
      <!--        <NuxtImg-->
      <!--            :src="config.header"-->
      <!--            alt=""-->
      <!--            aria-hidden="true"-->
      <!--            width="280"-->
      <!--            height="32"-->
      <!--            sizes="(max-width: 768px) min(85vw, 280px), 280px"-->
      <!--            class="h-8 w-auto max-w-[min(280px,85vw)]"-->
      <!--            loading="lazy"-->
      <!--            decoding="async"-->
      <!--        />-->
      <!--        <h2-->
      <!--            :id="headingId"-->
      <!--            class="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-lg font-bold text-shadow-md"-->
      <!--            :class="config.textShadow"-->
      <!--        >-->
      <!--          <slot />-->
      <!--        </h2>-->
      <!--      </header>-->

      <!--      &lt;!&ndash; Main content &ndash;&gt;-->
      <!--      <main class="grid grid-cols-7 items-center">-->
      <!--        &lt;!&ndash; Left user &ndash;&gt;-->
      <!--        <figure class="col-span-3 grid grid-cols-2">-->
      <!--          <UserAvatar-->
      <!--              :animated="true"-->
      <!--              defer-frame-animation-->
      <!--              :frame-girth="props.lFrameGirth"-->
      <!--              :top="props.lTop"-->
      <!--              :frame-name="props.lFrameName"-->
      <!--              v-bind="leftAvatarBindings"-->
      <!--              class="col-span-1"-->
      <!--          />-->
      <!--          <figcaption class="text-xs font-bold text-shadow-md w-full col-span-1" :class="config.textShadow">-->
      <!--            {{ props.lUserName || 'User Name' }}-->
      <!--          </figcaption>-->
      <!--        </figure>-->
      <!--        &lt;!&ndash; Decor element &ndash;&gt;-->
      <!--        <NuxtImg-->
      <!--            :src="config.decor"-->
      <!--            alt=""-->
      <!--            aria-hidden="true"-->
      <!--            width="80"-->
      <!--            height="80"-->
      <!--            sizes="80px"-->
      <!--            class="col-span-1"-->
      <!--            loading="lazy"-->
      <!--            decoding="async"-->
      <!--        />-->
      <!--        &lt;!&ndash; Right user &ndash;&gt;-->
      <!--        <figure class="col-span-3 grid grid-cols-2">-->
      <!--          <figcaption class="text-right text-xs font-bold text-shadow-md col-span-1" :class="config.textShadow">-->
      <!--            {{ props.rUserName || 'User Name' }}-->
      <!--          </figcaption>-->
      <!--          <UserAvatar-->
      <!--              :animated="true"-->
      <!--              defer-frame-animation-->
      <!--              :frame-girth="props.rFrameGirth"-->
      <!--              :top="props.rTop"-->
      <!--              :frame-name="props.rFrameName"-->
      <!--              v-bind="rightAvatarBindings"-->
      <!--              class="col-span-1"-->
      <!--          />-->
      <!--        </figure>-->
      <!--      </main>-->
      <!--    </NuxtLink>-->
      </a>
      </NuxtLink>
    </template>
  </UCarousel>

  <!-- Password Prompt Modal (for banners pointing at a password-protected room) -->
  <RoomPasswordPromptModal
      v-if="showPasswordPrompt && pendingRoom"
      v-model:open="showPasswordPrompt"
      :room="pendingRoom"
      @success="onPasswordSuccess"
  />
</template>

<style scoped>
  main > * {
    align-items: center;
  }
</style>
