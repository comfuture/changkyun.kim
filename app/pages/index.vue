<script setup lang="ts">
useSeoMeta({
  title: 'Home | Changkyun Kim',
  description: 'home | Changkyun Kim',
  ogTitle: 'Changkyun Kim',
  ogDescription: 'home | Changkyun Kim',
  ogType: 'website',
  twitterCard: 'summary_large_image',
})
useSiteOgImageMeta({
  image: '/image/cover2.jpg',
  alt: 'Changkyun Kim',
})

const { data: recent } = await useAsyncData('recentArticles', () =>
  queryCollection('blog')
    .select('id', 'path', 'title', 'description', 'createdAt', 'coverImage')
    .order('createdAt', 'DESC')
    .limit(9)
    .all()
)
const featuredArticle = computed(() => recent.value?.[0])
const remainingArticles = computed(() => recent.value?.slice(1) || [])
const { style: heroStyle, bind: heroBind } = useImageSrcSet('/image/cover2.jpg', {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})
</script>
<template>
  <UPage>
    <main>
      <section
        class="h-56 w-full bg-cover bg-center bg-no-repeat sm:h-64 md:h-72 lg:h-80 xl:h-88"
        v-bind="heroBind"
        :style="heroStyle"
        role="img"
        aria-label="Cover image"
      />

      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <div v-if="featuredArticle" class="mt-5">
            <ArticleCard :article="featuredArticle" variant="featured" eager />
          </div>
          <div
            v-if="remainingArticles.length"
            class="mt-6 grid auto-rows-[8px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [grid-auto-flow:dense]"
          >
            <ArticleCard
              v-for="(item, index) in remainingArticles"
              :key="item.id"
              :article="item"
              variant="grid"
              :class="[
                item.coverImage ? 'row-span-[21]' : 'row-span-[11]',
                item.coverImage && index % 5 === 0 ? 'lg:col-span-2 lg:row-span-[22]' : '',
                !item.coverImage && index % 4 === 1 ? 'lg:row-span-[12]' : '',
              ]"
            />
          </div>
          <div class="mt-6 flex justify-center">
            <UButton to="/blog/" variant="ghost" trailing-icon="i-lucide-arrow-right">
              Browse all articles
            </UButton>
          </div>
        </div>
      </section>
    </main>
  </UPage>
</template>
