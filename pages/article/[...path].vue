<script setup lang="ts">
const { fullPath } = useRoute()
</script>
<template>
  <section>
    <content-doc :path="fullPath" v-slot="{ doc }">
      <Head>
        <Title>{{ doc.title }} - changkyun.kim</Title>
      </Head>
      <article class="container">
        {{ doc.cover_image }}
        <nuxt-picture :src="doc.cover_image" v-if="doc.cover_image" />
        <h1>{{ doc.title }}</h1>
        <time datetime="doc.createdAt">{{ doc.createdAt }}</time>
        <section class="body">
          <content-renderer :value="doc" />
        </section>
      </article>
    </content-doc>
  </section>
</template>
<style lang="postcss">
article {
  @apply p-4 mx-auto;
  h1 {
    @apply text-xl font-bold;
  }

  .body {
    @apply leading-relaxed prose md:prose-lg max-w-none;
    @apply dark:prose-invert;

    h2, h3, h4 {
      /* @apply  */
      @apply prose-a:no-underline;
    }
    pre {
      @apply bg-gray-700 my-4 p-4 rounded overflow-x-auto;
    }

    :not(pre) > code {
      @apply break-all bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded;
    }

    code {
      &::before, &::after {
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
}
</style>