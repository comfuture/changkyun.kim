<template>
  <div class="mx-auto container flex flex-col md:flex-row">
    <div class="mt-16 py-4 pr-0 md:pr-4 flex-grow">
      <article-view :article="first" />
      <article-view :article="article" omitted
        v-for="article in articles" :key="article.path" />
    </div>
    <div class="bg-gray-200 mt-16 w-full md:w-64">
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
      // .then(documents => {
      //   return documents.map(doc => {
      //     doc.body.children = doc.body.children.slice(0, 2)
      //     return doc
      //   })
      // })
    const [[first], articles] = await Promise.all([mostRecent, remain])
    this.first = first
    this.articles = articles
  }
}
</script>
