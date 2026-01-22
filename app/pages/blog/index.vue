<script setup lang="ts">
const { path } = useRoute()
const { data } = await useAsyncData(path, () => {
  return queryCollection('blog')
    .select('id', 'path', 'title', 'createdAt')
    .order('createdAt', 'DESC')
    .limit(10)
    .all()
})
</script>
<template>
  <UPage>
    <UContainer>
      <main>
        <section>
          <nuxt-img src="/image/article-cover.jpg" preset="cover" alt="cover image" class="h-64 w-full object-cover" />
        </section>
        <section class="mt-10 px-6 sm:px-8">
          <h1 class="text-2xl font-semibold">Articles</h1>
          <ul class="mt-4 space-y-2" v-if="data">
            <li v-for="item in data" :key="item.id" class="flex items-center justify-between">
              <UButton :to="item.path" variant="link" class="p-0 text-left">
                {{ item.title }}
              </UButton>
              <span class="text-xs text-gray-500">{{ item.createdAt }}</span>
            </li>
          </ul>
        </section>
      </main>
    </UContainer>
  </UPage>
</template>
