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
    <h2>tags</h2>
    {{ serverData?.name }}
    {{ serverData?.result }}
    <!-- <ul>
      <li v-for="tag in tags">
        <nuxt-link :to="{ name: 'blog-tag-tag', params: { tag } }">
          {{ tag }}
        </nuxt-link>
      </li>
    </ul> -->
  </main>
</template>