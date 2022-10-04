<script setup lang="ts">
// const { data: page } = await useAsyncData('page', () => queryContent('/').findOne())
// const { data: recent } = await useAsyncData('recent', () => (
//   queryContent('article').find()
//   // .only(['title', 'description', 'path', 'updatedAt', 'createdAt'])
//   // .sortBy('updatedAt', 'desc')
//   // .limit(5)
//   // .fetch()
// ))
</script>
<template>
  <main>
    <header class="cover">
      <nuxt-img preset="cover" src="image/cover2.jpg" alt="cover image" />
    </header>
    <section class="articles">
      <div class="container">
        <!-- <div class="p-2 md:p-4 w-full md:w-1/2" v-for="article in recent" :key="article.slug">
          <article class="max-w-4xl px-10 my-4 py-6 bg-white rounded-lg shadow-md">
            <div class="flex justify-between items-center">
              <span class="font-light text-gray-600">{{ article.updatedAt }}</span>
            </div>
            <div class="mt-2">
              <n-link :to="article.path" class="text-2xl text-gray-700 font-bold hover:text-gray-600" href="#">{{
              article.title }}</n-link>
              <p class="mt-2 text-gray-600">{{ article.description }}</p>
            </div>
          </article>
        </div> -->
      </div>
    </section>
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
