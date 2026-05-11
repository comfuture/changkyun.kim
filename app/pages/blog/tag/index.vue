<script setup lang="ts">
import { siteKeywords } from '~/utils/siteIdentity'

const tagsDescription = '김창균(Changkyun Kim)의 개발, 프로그래밍, 정체성, 원칙, 언어, 문제 해결 관련 글 태그입니다. Blog tags by a Seoul-based developer.'

useSeoMeta({
  title: 'Blog Tags - 김창균 Changkyun Kim',
  description: tagsDescription,
  keywords: siteKeywords.join(', '),
  ogTitle: 'Blog Tags - 김창균 Changkyun Kim',
  ogDescription: tagsDescription,
  ogType: 'website',
  twitterCard: 'summary',
})
useSiteOgImageMeta({
  image: '/image/article-cover.jpg',
  alt: 'Blog Tags | Changkyun Kim',
})

const { data: tags } = useAsyncData('tags', () => $fetch('/api/blog/tags'))
</script>
<template>
  <UPage>
    <UContainer>
      <main>
        <section class="px-6 sm:px-8">
          <h2 class="text-xl font-semibold">Tags</h2>
          <ul v-if="tags" class="mt-4 flex flex-wrap gap-2">
            <li v-for="tag in tags" :key="tag">
              <UButton :to="{ name: 'blog-tag-tag', params: { tag } }" variant="outline" size="xs">
                {{ tag }}
              </UButton>
            </li>
          </ul>
        </section>
      </main>
    </UContainer>
  </UPage>
</template>
