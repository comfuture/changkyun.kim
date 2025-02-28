<script setup lang="ts">
const { path } = useRoute()
const { data } = await useAsyncData(path, () => {
  return queryCollection('blog')
    .select('id', 'path', 'title', 'createdAt')
    .order('createdAt', 'DESC')
    .limit(10)
    .all()
})
</script>
<template>
  <main>
    <!-- <img src="/image/article-cover.jpg" alt="cover image" /> -->
    <header class="cover">
      <nuxt-img src="/image/article-cover.jpg" preset="cover" alt="cover image" />
    </header>
    <section class="container">
      <ul>
        <li v-for="item in data" :key="item.id">
          <nuxt-link :to="item.path">{{ item.title }} {{ item.createdAt }}</nuxt-link>
        </li>
      </ul>
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