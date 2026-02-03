<script setup lang="ts">
const { path } = useRoute()
const { data } = await useAsyncData(path, () => {
  return queryCollection('blog')
    .select('id', 'path', 'title', 'createdAt')
    .order('createdAt', 'DESC')
    .limit(10)
    .all()
})
const img = useImage()
const coverStyle = computed(() => ({
  backgroundImage: `url('${img('/image/article-cover.jpg', {}, { preset: 'cover' })}')`,
}))
</script>
<template>
  <UPage>
    <main>
      <section
        class="h-64 w-full bg-cover bg-center bg-no-repeat sm:h-72 md:h-80 lg:h-96"
        :style="coverStyle"
        role="img"
        aria-label="Articles cover"
      />
      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <h1 class="text-2xl font-semibold">Articles</h1>
          <ul class="mt-4 space-y-2" v-if="data">
            <li v-for="item in data" :key="item.id" class="flex items-center justify-between">
              <UButton :to="item.path" variant="link" class="p-0 text-left">
                {{ item.title }}
              </UButton>
              <span class="text-xs text-gray-500">{{ item.createdAt }}</span>
            </li>
          </ul>
        </div>
      </section>
    </main>
  </UPage>
</template>
