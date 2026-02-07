<script setup lang="ts">
useSeoMeta({
  title: 'Home | Changkyun Kim',
  description: 'home | Changkyun Kim',
  ogTitle: 'Changkyun Kim',
  ogDescription: 'home | Changkyun Kim',
  ogType: 'website',
  ogImage: '/image/cover2.jpg',
  twitterCard: 'summary_large_image',
})

const { data: recent } = await useAsyncData('recentArticles', () =>
  queryCollection('blog')
    .select('id', 'path', 'title', 'createdAt')
    .order('createdAt', 'DESC')
    .limit(5)
    .all()
)
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

      <section class="mt-8">
        <div class="container mx-auto px-6 sm:px-8">
          <UBadge variant="subtle" color="primary">Welcome</UBadge>
          <p class="mt-4 text-lg text-gray-600 dark:text-gray-300">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget nunc ultrices lacinia. Nullam nec
          </p>
        </div>
      </section>

      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-xl font-semibold">Recent articles</h2>
            <UButton to="/blog/" variant="ghost" size="sm">View all</UButton>
          </div>
          <ul class="mt-4 space-y-2" v-if="recent">
            <li v-for="item in recent" :key="item.id">
              <UButton :to="item.path" variant="link" class="p-0 text-left">
                {{ item.title }}
              </UButton>
            </li>
          </ul>
        </div>
      </section>
    </main>
  </UPage>
</template>
