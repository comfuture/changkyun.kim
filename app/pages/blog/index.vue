<script setup lang="ts">
import { siteKeywords } from '~/utils/siteIdentity'

const route = useRoute()
const pageSize = 10
const blogDescription = '프로그래밍, 소프트웨어 개발, 정체성, 원칙, 언어, 학습, 문제 해결에 대한 개인 기록입니다.'

useSeoMeta({
  title: 'Blog - 김창균 Changkyun Kim Developer Notes',
  description: blogDescription,
  keywords: siteKeywords.join(', '),
  ogTitle: 'Blog - 김창균 Changkyun Kim Developer Notes',
  ogDescription: blogDescription,
  ogType: 'website',
  twitterCard: 'summary_large_image',
})
useSiteOgImageMeta({
  image: '/image/article-cover.jpg',
  alt: 'Blog | Changkyun Kim',
})

const { data } = await useAsyncData('blogArticles', () => $fetch('/api/blog/articles'))

const requestedPage = computed(() => {
  const page = Number(route.query.page)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
})

const totalArticles = computed(() => data.value?.length || 0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalArticles.value / pageSize)))
const currentPage = computed(() => Math.min(requestedPage.value, totalPages.value))
const pageArticles = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return data.value?.slice(start, start + pageSize) || []
})
const featuredArticle = computed(() => currentPage.value === 1 ? pageArticles.value[0] : undefined)
const listArticles = computed(() => currentPage.value === 1 ? pageArticles.value.slice(1) : pageArticles.value)
const pageTo = (page: number) => page <= 1 ? '/blog/' : `/blog/?page=${page}`

if (import.meta.prerender) {
  const [allEntries, tags] = await Promise.all([
    $fetch('/api/blog/articles'),
    $fetch('/api/blog/tags'),
  ])

  const routes = new Set<string>(['/blog', '/blog/tag'])
  for (const entry of allEntries) {
    if (entry.path) {
      routes.add(entry.path)
    }
  }

  for (const tag of tags) {
    routes.add(`/blog/tag/${encodeURIComponent(tag)}`)
  }

  for (const route of routes) {
    prerenderRoutes(route)
  }
}

const { style: coverStyle, bind: coverBind } = useImageSrcSet('/image/article-cover.jpg', {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})
</script>
<template>
  <UPage>
    <main>
      <section
        class="h-56 w-full bg-cover bg-center bg-no-repeat sm:h-64 md:h-72 lg:h-80 xl:h-88"
        v-bind="coverBind"
        :style="coverStyle"
        role="img"
        aria-label="Articles cover"
      />
      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <h1 class="text-2xl font-semibold">Articles</h1>
          <div v-if="featuredArticle" class="mt-5">
            <ArticleCard :article="featuredArticle" variant="list-featured" eager />
          </div>
          <div v-if="listArticles.length" class="mt-5 space-y-3">
            <ArticleCard
              v-for="item in listArticles"
              :key="item.id"
              :article="item"
              variant="list"
            />
          </div>
          <UPagination
            v-if="totalArticles > pageSize"
            class="mt-8 justify-center"
            :page="currentPage"
            :items-per-page="pageSize"
            :total="totalArticles"
            :to="pageTo"
            show-edges
            size="sm"
          />
        </div>
      </section>
    </main>
  </UPage>
</template>
