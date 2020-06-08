<template>
  <div>
    <section class="">
      <div class="container mx-auto items-center flex flex-wrap my-16 md:mt-48">
        <div class="w-full md:w-8/12 lg:w-6/12 xl:w-6/12 px-4">
          <nuxt-content :document="page" />
        </div>
      </div>
      <!-- <img class="absolute top-0 b-auto right-0 pt-16 sm:w-6/12 -mt-48 sm:mt-0 w-10/12 object-cover" src="https://images.unsplash.com/photo-1591308439494-984aedbc92ce?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=3334&q=80" alt="" style="max-height: 400px"> -->
    </section>
    <section class="bg-gray-200 py-2 lg:py-8">
      <div class="mx-auto container flex-wrap">
        <div class="p-2 md:p-4 w-full md:w-1/2" v-for="article in recent" :key="article.slug">
          <article class="bg-white border border-gray-600 shadow-md rounded-lg p-4 ">
            <header>
              <h3>
                <nuxt-link :to="article.path">{{ article.title }}</nuxt-link>
              </h3>
            </header>
            <p>{{ article.description }}</p>
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
