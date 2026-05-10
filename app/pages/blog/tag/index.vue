<script setup lang="ts">
useSeoMeta({
  title: 'Blog Tags | Changkyun Kim',
  description: 'blog | Changkyun Kim',
  ogTitle: 'Blog Tags | Changkyun Kim',
  ogDescription: 'blog | Changkyun Kim',
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
          <ul class="mt-4 flex flex-wrap gap-2" v-if="tags">
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
