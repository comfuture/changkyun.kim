<template>
  <div>
    <section class="cover md:pt-16 w-full">
      <nuxt-img responsive-style="thumb" class="object-cover w-full h-64" src="/image/cover2.jpg" />
    </section>
    <section class="bg-gray-200 py-2 lg:py-8">
      <div class="mx-auto container flex-wrap">
        <div class="p-2 md:p-4 w-full md:w-1/2" v-for="article in recent" :key="article.slug">
          <article class="max-w-4xl px-10 my-4 py-6 bg-white rounded-lg shadow-md">
            <div class="flex justify-between items-center">
              <span class="font-light text-gray-600">{{ $moment(article.createdAt).format('LL') }}</span>
            </div>
            <div class="mt-2">
              <n-link :to="article.path" class="text-2xl text-gray-700 font-bold hover:text-gray-600" href="#">{{ article.title }}</n-link>
              <p class="mt-2 text-gray-600">{{ article.description }}</p>
            </div>
            <div class="flex justify-between items-center mt-4">
              <n-link class="text-blue-600 hover:underline" :to="article.path">Read more</n-link>
            </div>
          </article>
        </div>
      </div>
    </section>
    <section class="portal">
      <div class="mx-auto container">...</div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'index',
  data() {
    return {
      page: '',
      recent: []
    }
  },
  async fetch() {
    this.page = await this.$content('index').fetch()
    this.recent = await this.$content('article', {deep: true})
      .only(['title', 'description', 'path', 'createdAt'])
      .sortBy('createdAt', 'desc')
      .limit(5)
      .fetch()
  }
}
</script>

<style lang="postcss">
.portal {
  @apply h-64;
}

h3 {
  @apply text-xl text-gray-600 font-bold;
}
</style>
