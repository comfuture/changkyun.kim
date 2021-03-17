<template>
  <div class="mx-auto container flex flex-col md:flex-row">
    <div class="mt-16 py-4 pr-0 md:my-64 flex-auto">
      <article-view :article="first" />
      <article-view :article="article" omitted
        v-for="article in articles" :key="article.path" />
    </div>
    <div class="flex-1 bg-gray-200 mt-16 w-full md:w-64 md:inset-y-0 md:right-0">
      여기에 사이드바 뭘 채우지
    </div>
  </div>
</template>
<script>
import ArticleView from '~/components/article-view'

export default {
  name: 'article-index',
  components: {
    ArticleView
  },
  data() {
    return {
      first: {},
      articles: []
    }
  },
  async fetch() {
    const mostRecent = this.$content('article', {deep: true})
      .only(['title', 'description', 'body', 'path', 'createdAt'])
      .sortBy('createdAt', 'desc')
      .limit(1)
      .fetch()
    const remain = this.$content('article', {deep: true})
      .only(['title', 'description', 'body', 'path', 'createdAt'])
      .sortBy('createdAt', 'desc')
      .skip(1)
      .limit(4)
      .fetch()
    const [[first], articles] = await Promise.all([mostRecent, remain])
    this.first = first
    this.articles = articles
  }
}
</script>
