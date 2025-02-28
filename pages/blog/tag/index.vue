<script setup lang="ts">
const { data: tags } = useAsyncData('tags', async () => {
  const query = await queryCollection('blog')
    .select('tags')
    .all()
  let set = new Set([])
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
    <ul>
      <li v-for="tag in tags">
        <nuxt-link :to="{ name: 'blog-tag-tag', params: { tag } }">
          {{ tag }}
        </nuxt-link>
      </li>
    </ul>
  </main>
</template>