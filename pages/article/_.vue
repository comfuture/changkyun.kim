<template>
  <div class="md:px-32 lg:px-48 mx-auto container mt-32">
    <article-view :article="article" />
  </div>
</template>
<script>
import ArticleView from '~/components/article-view'
export default {
  name: 'article-path',
  components: {
    ArticleView
  },
  head() {
    return {
      title: `${this.article.title} - changkyun.kim`,
      meta: [
        {hid: 'description', name: 'description', content: this.article.description}
      ]
    }
  },
  async asyncData({ $content, params: {pathMatch} }) {
    // static generate 되었을 때 canonical url 뒤에 trail slash 가 붙은 경우 컨텐츠를 찾을 수 없게 되는 것을 방지    
    const path = `article/${pathMatch.replace(/^\/|\/$/, '')}`
    const article = await $content(path).fetch()
    return {path, article}
  }
}
</script>
