<script setup lang="ts">
const { data: recent } = await useAsyncData('recentArticles', () =>
  queryCollection('blog')
    .select('id', 'path', 'title', 'createdAt')
    .order('createdAt', 'DESC')
    .limit(5)
    .all()
)
</script>
<template>
  <main>
    <header class="cover">
      <nuxt-img preset="cover" src="/image/cover2.jpg" alt="cover image" />
    </header>
    <section class="text">
      <div class="container">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget nunc ultrices lacinia. Nullam nec
      </div>
    </section>
    <section class="alternative text">
      <div class="container">
        <h2>Recent articles</h2>
        <ul v-for="item in recent" :key="item.id" v-if="recent">
          <li>
            <nuxt-link :to="item.path">{{ item.title }}</nuxt-link>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
<style lang="postcss">
main {
  header.cover {
    /* @apply md:pt-16 w-full; */

    img {
      @apply object-cover w-full h-64;
    }
  }

  .container {
    @apply flex-wrap mx-auto;
  }

  section.text {
    @apply py-10 px-2 md:px-0 md:py-16;
    @apply prose md:prose-lg max-w-none;

    h2 {
      @apply text-2xl font-bold text-gray-800 dark:text-gray-300 mb-4;
    }
  }

  section.alternative {
    @apply bg-gray-200 dark:bg-gray-600;
  }

  section.articles {
    @apply bg-gray-200 py-2 lg:py-8;

    >.container {
      @apply flex flex-wrap gap-2;

      .ui.card {
        @apply w-full md:w-1/2;
      }
    }
  }
}
</style>