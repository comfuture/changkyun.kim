<script setup lang="ts">
import { buildPersonJsonLd, siteDescription, siteKeywords } from '~/utils/siteIdentity'

const aboutDescription = '김창균(Changkyun Kim)은 대한민국 서울에 거주하는 개발자입니다. 한국어와 영어로 원칙, 정체성, 언어, 선호, 학습, 문제 해결, 프로그래밍에 대해 기록합니다.'

useSeoMeta({
  title: 'About 김창균 Changkyun Kim - Seoul Developer',
  description: aboutDescription,
  keywords: siteKeywords.join(', '),
  ogTitle: 'About 김창균 Changkyun Kim - Seoul Developer',
  ogDescription: siteDescription,
  ogType: 'profile',
  twitterCard: 'summary_large_image',
})
useSiteOgImageMeta({
  image: '/image/cover.jpg',
  alt: 'Changkyun Kim',
})
const { style: coverStyle, bind: coverBind } = useImageSrcSet('/image/cover.jpg', {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})

useHead({
  meta: [
    { property: 'profile:first_name', content: 'Changkyun' },
    { property: 'profile:last_name', content: 'Kim' },
    { property: 'profile:username', content: 'changkyun.kim' },
  ],
  script: [
    {
      key: 'about-person-json-ld',
      type: 'application/ld+json',
      innerHTML: JSON.stringify(buildPersonJsonLd()),
    },
  ],
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
          <p class="mt-2 text-sm text-gray-500">Changkyun Kim · Developer · 대한민국 서울 / Seoul, South Korea</p>
          <div class="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            <UBadge variant="subtle" color="neutral">한국어</UBadge>
            <UBadge variant="subtle" color="neutral">日本語</UBadge>
            <UBadge variant="subtle" color="neutral">English</UBadge>
            <UBadge variant="subtle" color="neutral">Español</UBadge>
          </div>
          <p class="mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-gray-600 dark:text-gray-300">
            김창균은 대한민국 서울에 거주하는 개발자입니다. Changkyun Kim is a developer based in Seoul,
            South Korea, writing about programming, identity, language, preferences, principles, learning, and problem solving.
          </p>
        </div>
      </section>

      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <div
            class="mx-auto max-w-2xl text-[15px] leading-relaxed text-gray-700 dark:text-gray-200 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mt-8 [&>h3]:mb-2 [&>p]:text-[15px] [&>p]:leading-relaxed [&>ul]:mt-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul>li]:my-1"
          >
            <h3>의로운 원칙주의자</h3>
            <p>원리와 원칙을 중요시 여기며 말과 행동이 악의 편에 서지 않게 하기 위해 노력합니다.</p>
            <p>In English: I value principled integrity and try to keep my words and actions away from the side of malice.</p>
            <h3>슬로우 러너</h3>
            <p>빠르게 배우지 못하지만 꾸준히 익히며 깊이있게 이해하고 적절히 사용합니다.</p>
            <p>I learn slowly, persistently, and deeply enough to use what I learn with care.</p>
            <h3>해결사</h3>
            <p>데이터와 경험과 직관을 이용하여 문제를 해결하는 것을 좋아하고 잘 합니다.</p>
            <p>I like solving problems with data, experience, intuition, and practical software development.</p>
            <h3>정체성</h3>
            <p>
              이름은 김창균, 영어 이름은 Changkyun Kim입니다. 대한민국 서울에 살며 한국어와 영어로 생각과 작업을 기록합니다.
            </p>
            <p>
              I am 김창균 / Changkyun Kim, a Seoul-based Korean developer. This site is my personal identity surface and writing archive.
            </p>
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
