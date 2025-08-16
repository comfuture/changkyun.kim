<script setup lang="ts">
const { path } = useRoute()
const { data } = await useAsyncData(() => queryCollection('app').path(path).first())

useSeoMeta({
  title: data.value?.title,
  description: data.value?.description,
})
</script>
<template>
  <article class="container mx-auto" v-if="data">
    <nuxt-img preset="cover" class="cover" :src="data.coverImage" :alt="data.title" v-if="data.coverImage" />
    <header>
      <h1>{{ data.title }}</h1>
      <ui-datetime :datetime="data.createdAt" />
      <div class="tags">
        <ul class="flex gap-2">
          <li v-for="tag in data.tags" :key="tag">{{ tag }}</li>
        </ul>
      </div>
    </header>
    <div class="body">
      <content-renderer :value="data" />
    </div>
  </article>
  <div v-else>Document Not Found</div>
</template>
<style lang="postcss">
article.container {
  @apply mx-auto max-w-2xl;

  img.cover {
    @apply w-full;
  }

  >header {
    h1 {
      @apply my-2 text-xl font-bold;
    }
  }

  .body {
    @apply p-4 leading-relaxed prose md:prose-lg;
    @apply dark:prose-invert;

    h2,
    h3,
    h4 {
      /* @apply  */
      @apply prose-a:no-underline;
    }

    pre {
      @apply bg-gray-700 my-4 p-4 rounded overflow-x-auto;
    }

    :not(pre)>code {
      @apply break-all bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded;
    }

    code {

      &::before,
      &::after {
        @apply hidden;
      }

      &[lang] {
        @apply bg-gray-600 font-normal;
      }
    }

    section.footnotes {
      @apply mt-8;
    }
  }

  .tags {
    @apply flex gap-2;

    li {
      @apply px-2 rounded border border-blue-300 bg-blue-100;

      &::before {
        content: '#';
      }
    }
  }
}
</style>