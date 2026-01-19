<script setup lang="ts">
// const route = useRoute()
// const { data: serverData } = await useFetch('/api/blog/tag', {
//   params: {
//     tag: route.params.tag,
//   },
// })
const { data: tags } = useAsyncData('tags', async () => {
  const query = await queryCollection('blog')
    .select('tags')
    .all()
  let set = new Set<string>([])
  for (const article of query) {
    if (article.tags) {
      for (const tag of article.tags) {
        set.add(tag)
      }
    }
  }
  let tags = Array.from(set)
  tags.sort()
  return tags
})
</script>
<template>
  <main>
    <UCard class="p-6 md:p-8">
      <h2 class="text-xl font-semibold">Tags</h2>
      <ul class="mt-4 flex flex-wrap gap-2" v-if="tags">
        <li v-for="tag in tags" :key="tag">
          <UButton :to="{ name: 'blog-tag-tag', params: { tag } }" variant="outline" size="xs">
            {{ tag }}
          </UButton>
        </li>
      </ul>
    </UCard>
  </main>
</template>