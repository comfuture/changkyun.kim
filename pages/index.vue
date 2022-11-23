<script setup lang="ts">
  const { data: recent } = useAsyncData('recentArticles', () =>
    queryContent('/article')
      .only(['_path', 'title', 'createdAt', 'path'])
      .sort({ createdAt: -1 })
      .limit(5)
      .find()
  )
</script>
<template>
  <main>
    <header class="cover">
      <img src="/image/cover2.jpg" />
    </header>
    <section class="text">
      <div class="container">
        <content-doc path="/" :head="false" />
      </div>
    </section>
    <!-- {{ recent }} -->
    <section class="alternative text">
      <div class="container">
        <h2>Recent articles</h2>
        <ul v-for="item in recent" :key="item._path">
          <li>
            <nuxt-link :to="item._path">{{ item.title }}</nuxt-link>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>
<style lang="postcss">
  .portal {
    @apply h-64;
  }
/*   
  h3 {
    @apply text-xl text-gray-600 font-bold;
  } */
  </style>
<style lang="postcss" scoped>
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
  