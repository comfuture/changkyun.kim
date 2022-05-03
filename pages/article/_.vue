<template>
  <main>
    <section class="cover">
      <nuxt-img v-if="article.cover_image" preset="cover" class="object-cover w-full" :src="article.cover_image" />
      <nuxt-img v-else preset="cover" class="object-cover w-full" src="/image/article-cover.jpg" />
    </section>
    <section class="content">
      <div class="container">
        <article>
          <div class="heading">
            <h2>
              {{ article.title }}  
            </h2>
            <p class="meta">
              <span class="material-icons">update</span>
              <ui-timeago :value="article.updatedAt || article.createdAt" />
            </p>
          </div>
          <div class="body prose lg:prose-lg">
            <nuxt-content :document="article" />
          </div>
          <div class="p-2">
            <script src="https://giscus.app/client.js"
              data-repo="comfuture/changkyun.kim"
              data-repo-id="MDEwOlJlcG9zaXRvcnk2MDA1ODkxNA=="
              data-category="Comments"
              data-category-id="DIC_kwDOA5RtIs4CO5IY"
              data-mapping="pathname"
              data-reactions-enabled="1"
              data-emit-metadata="0"
              data-input-position="top"
              data-theme="light"
              data-lang="ko"
              crossorigin="anonymous"
              async>
            </script>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>
<script>
import { createPopper } from '@popperjs/core'
import ArticleView from '~/components/article-view'
import UiTimeago from '~/components/ui-timeago.vue'
// import TimeAgo from '~/components/time-ago'

export default {
  name: 'article-path',
  components: {
    ArticleView, UiTimeago
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
section.cover {
  @apply md:pt-6;

  img {
    @apply object-cover w-full h-48 lg:h-64;

    @screen lg {
      height: 250px !important;
    }

    @screen xl {
      height: 350px !important;
    }
  }
}

section.content {
  @apply md:bg-gray-200;

  .container {
    @apply mx-auto items-center flex flex-wrap md:-mt-24 md:pb-8;
    
    article {
      @apply flex flex-col w-full;
      @apply md:w-10/12 md:mx-auto md:rounded-lg md:bg-white md:shadow-xl;
      @apply lg:w-8/12;

      .heading {
        @apply py-6 px-4 mb-2 border-b border-gray-300 flex flex-col justify-between;
        @apply lg:px-8 lg:py-12 lg:flex-row;

        data.name {
          @apply block text-xl;
        }

        h2 {
          @apply text-lg lg:text-xl font-semibold;
        }

        .meta {
          @apply text-gray-400 flex gap-2 items-center;
        }
      }
      .body {
        @apply max-w-none;
      }
    }
  }
}
</style>
<style lang="postcss">
.nuxt-content {
  @apply p-2 md:p-4;

  p > code {
    word-break: break-all !important;
    @apply border border-purple-200 rounded-sm bg-purple-100 px-2;
    &:before, &:after {
      content: ''
    }
  }

  a {
    @apply underline text-blue-600;
  }

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
      @apply absolute inline-block border border-gray-400 bg-gray-100 p-2 rounded-md shadow-md w-full md:w-1/2;

      .invisible {
        @apply opacity-0;
      }

      a.footnote-backref {
        @apply hidden;
      }

      &::before {
        content: '';
      }
    }
  }
}

.nuxt-content-highlight {
  * {
    @apply text-xs !important;
  }

  @apply md:text-base my-6;
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