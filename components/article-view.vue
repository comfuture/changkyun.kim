<template>
  <article class="article">
    <header>
      <h1>
        {{ article.title }}
      </h1>
      <p class="meta">
        <time-ago :date="article.updatedAt || article.createdAt"></time-ago>
      </p>
    </header>
    <div class="content prose lg:prose-lg max-w-3xl">
      <nuxt-content :document="omittedArticle" v-if="omitted" />
      <nuxt-content :document="article" v-else />
    </div>
    <span v-if="omitted">
      <n-link :to="article.path">더 보기...</n-link>
    </span>
  </article>
</template>
<script>
import { createPopper } from '@popperjs/core'
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
  },
  data() {
    return {
      footnotes: []
    }
  },
  mounted() {
    this.makeFloatingFootnote()
  },
  methods: {
    /** 각주를 마우스/터치 인터렉션에 따라 표시되는 팝오버로 바꾼다 */
    makeFloatingFootnote() {
      const notes = this.$el.querySelectorAll('.footnotes li[id]')

      notes.forEach(note => {
        note.classList.add('invisible')
        let anchor = document.querySelector('a[href="#' + note.id + '"]')
        createPopper(anchor, note, {
          placement: 'bottom',
          modifiers: [{name: 'offset', options: {offset: [0, 10]}}]
        });

        anchor.addEventListener('click', e => e.preventDefault());

        (['pointerenter', 'focus']).forEach(ev => {
          anchor.addEventListener(ev, e => note.classList.remove('invisible'))
        });

        (['pointerleave', 'blur']).forEach(ev => {
          anchor.addEventListener(ev, e => note.classList.add('invisible'))
        })
      })
    }
  }
}
</script>
<style scoped lang="postcss">
article.article {
  @apply mx-2 mb-6 md:mx-0;

  header {
    h1 {
      @apply text-gray-700 font-semibold text-2xl mb-2 md:text-4xl;
    }

    h2 {
      @apply text-gray-700 font-semibold text-xl mb-2 md:text-2xl;
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
  p > code {
    @apply border border-indigo-200 rounded bg-indigo-100 px-2 font-normal;
    &:before, &:after {
      content: ''
    }
  }

  a {
    @apply underline text-blue-600;
  }

  /* ul {
    @apply ml-4;
    li {
      list-style-type: disc;
    }
  }

  ol {
    list-style-type: decimal;
    @apply ml-4;
  } */

  a.footnote-ref {
    text-decoration: none;
    @apply text-gray-700 border bg-purple-200 rounded-full px-2;
  }


  .footnotes {
    @apply py-6;

    hr {
      @apply hidden;
    }

    li {
      &:before {
        content: ''
      }

      @apply absolute inline-block border border-gray-400 bg-gray-100 p-2 rounded-md shadow-md w-full text-sm text-gray-700 md:w-1/2;

      .invisible {
        @apply opacity-0;
      }

      a.footnote-backref {
        @apply hidden;
      }
    }
  }
}

.nuxt-content-highlight {
  * {
    @apply text-xs !important;
  }
  @apply md:text-base;
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
