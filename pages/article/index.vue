<script setup lang="ts">
import { QueryBuilderParams } from '@nuxt/content/dist/runtime/types';

definePageMeta({
  name: 'article-index',
})
// const { data: recent } = useAsyncData('recentArticles', () =>
//   queryContent('/article')
//     .sort({ createdAt: -1 })
//     .limit(2)
//     .find()
// )
</script>
<template>
  <main>
    <section class="cover">
      <nuxt-img preset="cover" src="/image/article-cover.jpg" alt="cover image" />
    </section>
    <section class="alternative text">
      <div class="content">
        <content-list v-slot="{ list }" path="/article">
          <nuxt-link v-for="item in list" :key="item._path" :to="item._path">
            <h2>{{ item.navTitle || item.title }}</h2>
            <!-- <time datetime="item.createdAt">{{ item.createdAt }}</time> -->
            <ui-datetime :datetime="item.createdAt" />
          </nuxt-link>
        </content-list>
      </div>
    </section>
  </main>
</template>
<style lang="postcss" scoped>
main {
  @apply flex flex-col;

  section.cover {
    img {
      @apply object-cover w-full h-64;

      @screen lg {
        @apply h-[300px];
        height: 300px !important;
      }

      @screen xl {
        height: 400px !important;
      }
    }
  }

  section.text {
    @apply py-10 px-2 md:px-0 md:py-16;
  }

  .content {
    @apply container mx-auto px-2 md:px-0;
  }
}
</style>