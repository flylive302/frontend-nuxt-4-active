<script setup lang="ts">
import { EVENT_BANNERS } from '~/constants/assets'

defineOptions({ name: 'EventBanners' })

const banners = Object.values(EVENT_BANNERS)
</script>

<template>
  <UCarousel
      :autoplay="true"
      :items="banners"
      class-names
      :ui="{
        item: 'basis-3/4 transition duration-800 ease-in-out scale-90 [&.is-snapped]:scale-100 squircle'
      }"
  >
    <template #default="{ item }">
      <NuxtLink :to="item.navigateTo">
      <!-- Decorative banner background -->
      <img
          :src="item.banner"
          alt=""
          aria-hidden="true"
          width="360"
          height="120"
          class="h-full w-full rounded-lg"
      />

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
      </NuxtLink>
    </template>
  </UCarousel>
</template>

<style scoped>
  main > * {
    align-items: center;
  }
</style>
