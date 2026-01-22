<script setup lang="ts">
useHead({
  title: 'about me'
})
</script>
<template>
  <UPage>
    <UContainer>
      <main class="pb-16">
        <section class="relative">
          <nuxt-img
            class="h-44 w-full object-cover sm:h-56 md:h-72 lg:h-96"
            preset="cover"
            src="/image/cover.jpg"
            alt="Changkyun Kim cover"
          />
          <div class="absolute left-1/2 -bottom-12 -translate-x-1/2 sm:-bottom-14">
            <nuxt-img
              src="/image/avatar.jpg"
              alt="Changkyun Kim"
              class="h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-lg sm:h-32 sm:w-32 md:h-36 md:w-36 dark:ring-gray-900"
            />
          </div>
        </section>

        <section class="mt-16 px-6 text-center sm:px-8">
          <h1 class="text-2xl font-semibold">김창균</h1>
          <p class="mt-2 text-sm text-gray-500">Seoul, KOREA</p>
          <div class="mt-3 flex flex-wrap justify-center gap-2 text-xs">
            <UBadge variant="subtle" color="neutral">한국어</UBadge>
            <UBadge variant="subtle" color="neutral">日本語</UBadge>
            <UBadge variant="subtle" color="neutral">English</UBadge>
            <UBadge variant="subtle" color="neutral">Español</UBadge>
          </div>
        </section>

        <section class="mt-10 px-6 sm:px-8">
          <div class="prose mx-auto max-w-2xl">
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
        </section>
      </main>
    </UContainer>
  </UPage>
</template>
