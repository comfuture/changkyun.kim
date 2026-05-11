<script setup lang="ts">
import { siteKeywords } from '~/utils/siteIdentity'

const { params: { tag } } = useRoute()
const tagDescription = `${tag} 관련 글 목록입니다. Development, programming, identity, principles, and problem solving notes.`

useSeoMeta({
  title: `Tag: ${tag} | Changkyun Kim`,
  description: tagDescription,
  keywords: () => [...siteKeywords, String(tag)].join(', '),
  ogTitle: `Tag: ${tag} | Changkyun Kim`,
  ogDescription: tagDescription,
  ogType: 'website',
  twitterCard: 'summary',
})
useSiteOgImageMeta({
  image: '/image/article-cover.jpg',
  alt: `Tag: ${tag} | Changkyun Kim`,
})
</script>
<template>
  <UPage>
    <UContainer>
      <main>
        <section class="px-6 sm:px-8">
          <h2 class="text-xl font-semibold">{{ tag }}에 대한 글들</h2>
          <p class="mt-2 text-sm text-gray-500">
            {{ tag }} 관련 글을 모았습니다.
          </p>
        </section>
      </main>
    </UContainer>
  </UPage>
</template>
