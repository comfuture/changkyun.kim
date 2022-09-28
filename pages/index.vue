<script setup lang="ts">
  const { data: recent } = useAsyncData('recentArticles', () =>
    queryContent('/article')
      .only(['id', '_path', 'title', 'createdAt', 'path'])
      .sort({ createdAt: -1 })
      .limit(5)
      .find()
  )
</script>
<template>
  <main>
    <header class="cover">
      <nuxt-img preset="cover" src="/image/cover2.jpg" alt="cover image" />
    </header>
    <ContentDoc path="/" />
    <!-- {{ recent }} -->
    <ul v-for="item in recent" :key="item._path">
      <li>
        <h2>
          <nuxt-link :to="item._path">{{ item.title }}</nuxt-link>
        </h2>
      </li>
    </ul>
  </main>
</template>
<style lang="postcss">
  .portal {
    @apply h-64;
  }
  
  h3 {
    @apply text-xl text-gray-600 font-bold;
  }
  </style>
  <style lang="postcss" scoped>
  main {
    header.cover {
      @apply md:pt-16 w-full;
  
      img {
        @apply object-cover w-full h-64;
      }
    }
  
    .container {
      @apply flex-wrap mx-auto;
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
  