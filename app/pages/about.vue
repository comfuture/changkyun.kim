<script setup lang="ts">
useHead({
  title: 'about me'
})
const { style: coverStyle, bind: coverBind } = useImageSrcSet('/image/cover.jpg', {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})
</script>
<template>
  <UPage>
    <main class="pb-16">
      <section
        class="relative w-full overflow-visible bg-cover bg-center bg-no-repeat h-40 sm:h-48 md:h-64 lg:h-72 xl:h-80"
        v-bind="coverBind"
        :style="coverStyle"
        role="img"
        aria-label="Changkyun Kim cover"
      >
        <div class="absolute left-1/2 bottom-0 z-10 -translate-x-1/2 translate-y-1/2">
          <nuxt-img
            src="/image/avatar.jpg"
            alt="Changkyun Kim"
            class="h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-lg sm:h-32 sm:w-32 md:h-36 md:w-36 dark:ring-gray-900"
          />
        </div>
      </section>

      <section class="mt-20 sm:mt-24 md:mt-28">
        <div class="container mx-auto px-6 text-center sm:px-8">
          <h1 class="text-2xl font-semibold">김창균</h1>
          <p class="mt-2 text-sm text-gray-500">Seoul, KOREA</p>
          <div class="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            <UBadge variant="subtle" color="neutral">한국어</UBadge>
            <UBadge variant="subtle" color="neutral">日本語</UBadge>
            <UBadge variant="subtle" color="neutral">English</UBadge>
            <UBadge variant="subtle" color="neutral">Español</UBadge>
          </div>
        </div>
      </section>

      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <div
            class="mx-auto max-w-2xl text-[15px] leading-relaxed text-gray-700 dark:text-gray-200 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-8 [&>h3]:mb-2 [&>p]:text-[15px] [&>p]:leading-relaxed [&>ul]:mt-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1"
          >
            <h3>의로운 원칙주의자</h3>
            <p>원리와 원칙을 중요시 여기며 말과 행동이 악의 편에 서지 않게 하기 위해 노력합니다.</p>
            <h3>슬로우 러너</h3>
            <p>빠르게 배우지 못하지만 꾸준히 익히며 깊이있게 이해하고 적절히 사용합니다.</p>
            <h3>해결사</h3>
            <p>데이터와 경험과 직관을 이용하여 문제를 해결하는 것을 좋아하고 잘 합니다.</p>
            <h3>관심있는 것</h3>
            <ul>
              <li>육아</li>
              <li>요리</li>
              <li>프로그래밍</li>
              <li>캠핑</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  </UPage>
</template>
