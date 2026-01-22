<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(route.path, () => queryCollection('blog').path(route.path).first())
const { data: surround } = await useAsyncData(`${route.path}-surround`, () => {
  return queryCollectionItemSurroundings('blog', route.path, {
    fields: ['title', 'description'],
  })
})

useSeoMeta({
  title: data.value?.title,
  description: data.value?.description,
})
</script>
<template>
  <UContainer>
    <UPage v-if="data">
      <template #right>
        <UPageAside>
          <UContentToc v-if="data?.body?.toc?.links?.length" :links="data.body.toc.links" />
        </UPageAside>
      </template>
      <UPageBody>
        <section v-if="data.coverImage">
          <nuxt-img preset="cover" class="w-full object-cover" :src="data.coverImage" :alt="data.title" />
        </section>
        <section class="mt-10 px-2 sm:px-4">
          <header class="space-y-3">
            <h1 class="text-2xl font-semibold">{{ data.title }}</h1>
            <ui-datetime :datetime="data.createdAt" />
            <div class="flex flex-wrap gap-2" v-if="data.tags">
              <UBadge v-for="tag in data.tags" :key="tag" variant="subtle" color="primary">
                {{ tag }}
              </UBadge>
            </div>
          </header>
          <div class="prose mt-6 max-w-none">
            <ContentRenderer :value="data" />
          </div>
          <USeparator v-if="surround?.filter(Boolean).length" class="my-8" />
          <UContentSurround v-if="surround?.filter(Boolean).length" :surround="(surround as any)" />
        </section>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
