<template>
  <main>
    <section class="cover">
      <nuxt-img v-if="article.cover_image" preset="large" class="object-cover w-full" :src="article.cover_image" />
      <nuxt-img v-else preset="large" class="object-cover w-full" src="/image/article-cover.jpg" />
    </section>
    <section class="content">
      <div class="container">
        <div class="wrap">
          <div class="heading">
            <h2>
              {{ article.title }}  
            </h2>
            <p class="meta">
              <time-ago :date="article.updatedAt || article.createdAt"></time-ago>
            </p>
          </div>
          <div class="body prose lg:prose-lg">
            <nuxt-content :document="article" />
          </div>
        </div>
      </div>
    </section>
  </main>
</template>
<script>
import { createPopper } from '@popperjs/core'
import ArticleView from '~/components/article-view'
import TimeAgo from '~/components/time-ago'

export default {
  name: 'article-path',
  components: {
    ArticleView, TimeAgo
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
  @screen md {
    @apply pt-16;
  }

  img {
    @apply object-cover w-full h-48;

    @screen lg {
      height: 250px !important;
      @apply h-64;
    }

    @screen xl {
      height: 350px !important;
    }
  }
}

section.content {
  @screen md {
    @apply bg-gray-200;
  }

  .container {
    @apply mx-auto items-center flex flex-wrap;
    
    @screen md {
      @apply -mt-24 pb-8
    }

    .wrap {
      @apply flex flex-col w-full;
      
      @screen md {
        @apply w-10/12 mx-auto rounded-lg bg-white shadow-lg;
      }

      @screen xl {
        @apply w-8/12;
      }

      .heading {
        @apply py-6 px-4 mb-2 border-b border-gray-300 flex flex-col justify-between;

        data.name {
          @apply block text-xl;
        }

        h2 {
          @apply text-lg font-semibold;

          @screen lg {
            @apply text-xl;
          }
        }

        .meta {
          @apply text-gray-400
        }

        @screen lg {
          @apply px-8 py-12 flex-row;
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
  @apply p-2;

  @screen md {
    @apply p-4;
  }

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