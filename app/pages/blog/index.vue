<script setup lang="ts">
const route = useRoute()
const pageSize = 10

useSeoMeta({
  title: 'Blog | Changkyun Kim',
  description: 'blog | Changkyun Kim',
  ogTitle: 'Blog | Changkyun Kim',
  ogDescription: 'blog | Changkyun Kim',
  ogType: 'website',
  ogImage: '/image/article-cover.jpg',
  twitterCard: 'summary_large_image',
})

const { data } = await useAsyncData('blogArticles', () => {
  return queryCollection('blog')
    .select('id', 'path', 'title', 'description', 'createdAt', 'coverImage')
    .order('createdAt', 'DESC')
    .all()
})

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
  const [allEntries, tagEntries] = await Promise.all([
    queryCollection('blog').select('path').all(),
    queryCollection('blog').select('tags').all(),
  ])

  const routes = new Set<string>(['/blog', '/blog/tag'])
  for (const entry of allEntries) {
    if (entry.path) {
      routes.add(entry.path)
    }
  }

  const tags = new Set<string>()
  for (const entry of tagEntries) {
    if (!entry.tags) {
      continue
    }
    for (const tag of entry.tags) {
      tags.add(tag)
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
