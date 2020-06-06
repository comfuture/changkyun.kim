<template>
  <div class="mx-auto container">
    <article class="pt-32">
      <header>
        <h1>{{ article.title }}</h1>
      </header>
      <nuxt-content :document="article" />
    </article>
  </div>
</template>
<script>
export default {
  name: 'article-path',
  async asyncData({ $content, params: {pathMatch} }) {
    // static generate 되었을 때 canonical url 뒤에 trail slash 가 붙은 경우 컨텐츠를 찾을 수 없게 되는 것을 방지    
    const path = `article/${pathMatch.replace(/^\/|\/$/, '')}`
    const article = await $content(path).fetch()
    return {path, article}
  }
}
</script>
<style lang="postcss">
article {
  @apply mx-2;
  @screen md {
    @apply mx-0;
  }
}

.nuxt-content-highlight {
  @apply my-6;
  > .filename {
    @apply text-gray-600;

    &:before {
      font-family: 'Material Icons';
      font-weight: normal;
      font-style: normal;
      font-size: 20px;
      line-height: 1em;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-feature-settings: 'liga';
      -webkit-font-smoothing: antialiased;
      content: "code";
      margin: 0 .5em;
    }
  }

  > pre {
    @apply rounded-md shadow-md;
  }  
}
</style>