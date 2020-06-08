<template>
  <article class="article">
    <header>
      <h1>
        {{ article.title }}
      </h1>
      <p class="meta">
        <time-ago :date="article.createdAt"></time-ago>
      </p>
    </header>
    <nuxt-content :document="omittedArticle" v-if="omitted" />
    <nuxt-content :document="article" v-else />
    <span v-if="omitted">
      <n-link :to="article.path">더 보기...</n-link>
    </span>
  </article>
</template>
<script>
import TimeAgo from './time-ago'

export default {
  name: 'article-view',
  components: {
    TimeAgo
  },
  props: {
    article: Object,
    omitted: Boolean
  },
  computed: {
    omittedArticle() {
      return {
        ...this.article,
        body: {
          ...this.article.body,
          children: this.article.body.children.slice(0, 2)
        }
      }
    }
  }
}
</script>
<style lang="postcss">
article.article {
  @apply mx-2 mb-6;
  @screen md {
    @apply mx-0;
  }

  header {
    @apply;

    h1 {
      @apply text-gray-700 font-semibold text-2xl mb-2;
      @screen md {
        @apply text-4xl;
      }
    }

    h2 {
      @apply text-gray-700 font-semibold text-xl mb-2;
      @screen md {
        @apply text-2xl;
      }
    }

    p.meta {
      min-height: 2em;
      .created-at {
        @apply float-right text-gray-500;
      }
    }
  }
}

.nuxt-content {
  h1 {
    @apply text-gray-700 font-semibold text-2xl my-6;
    @screen md {
      @apply text-4xl;
    }
  }

  h2 {
    @apply text-gray-700 font-semibold text-xl my-4;
    @screen md {
      @apply text-2xl;
    }
  }

  p {
    @apply text-gray-700 py-2;
  }

  a {
    @apply underline text-blue-600;
  }

  ul {
    @apply ml-4;
    li {
      list-style-type: disc;
    }
  }

  ol {
    list-style-type: decimal;
    @apply ml-4;
  }


  .footnotes {
    @apply py-6;
  }
}

.nuxt-content-highlight {
  @apply text-xs;
  @screen md {
    @apply text-base;
  }
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
