<script setup lang="ts">
useHead({
  title: 'about me'
})
</script>
<template>
  <main class="space-y-10">
    <UCard class="overflow-hidden">
      <nuxt-img class="object-cover w-full h-40 md:h-64 lg:h-80 xl:h-96" preset="cover" src="/image/cover.jpg" />
    </UCard>
    <UCard class="p-6 md:p-8">
      <div class="flex flex-col items-center text-center">
        <UAvatar src="/image/avatar.jpg" size="3xl" class="mb-4" />
        <div class="text-lg font-semibold">김창균</div>
        <div class="mt-2 text-sm text-gray-500">
          <i class="material-symbols-outlined">place</i>
          Seoul, KOREA
        </div>
        <div class="text-sm text-gray-500">
          <i class="material-symbols-outlined">announcement</i>
          한국어, 日本語, English, Español
        </div>
      </div>
      <UProse class="mt-8 max-w-none">
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
      </UProse>
    </UCard>
  </main>
</template>
