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
    <div class="content prose lg:prose-lg">
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
  /* h1 {
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

  blockquote {
    @apply border-l-8 border-gray-300 pl-6;
  }
  */
  p > code {
    @apply border border-purple-200 rounded-sm bg-purple-100 px-2;
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
    @apply text-gray-700 border border-gray-400 bg-blue-100 rounded-full px-2;
  }


  .footnotes {
    @apply py-6;

    hr {
      @apply hidden;
    }

    li {
      @apply absolute inline-block border border-gray-400 bg-gray-100 p-2 rounded-md shadow-md w-full;

      .invisible {
        @apply opacity-0;
      }

      @screen md {
        @apply w-1/2
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
