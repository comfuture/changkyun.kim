<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(route.path, () => queryCollection('app').path(route.path).first())
const { data: surround } = await useAsyncData(`${route.path}-surround`, () => {
  return queryCollectionItemSurroundings('app', route.path, {
    fields: ['title', 'description'],
  })
})

useSeoMeta({
  title: data.value?.title,
  description: data.value?.description,
})
</script>
<template>
  <UContainer class="py-10" v-if="data">
    <UCard class="overflow-hidden" v-if="data.coverImage">
      <nuxt-img preset="cover" class="w-full object-cover" :src="data.coverImage" :alt="data.title" />
    </UCard>
    <UCard class="mt-6 p-6 md:p-8">
      <header class="space-y-3">
        <h1 class="text-2xl font-semibold">{{ data.title }}</h1>
        <ui-datetime :datetime="data.createdAt" />
        <div class="flex flex-wrap gap-2" v-if="data.tags">
          <UBadge v-for="tag in data.tags" :key="tag" variant="subtle" color="primary">
            {{ tag }}
          </UBadge>
        </div>
      </header>
      <UContentToc v-if="data?.body?.toc?.links?.length" class="mt-6" :links="data.body.toc.links" />
      <UProse class="mt-6 max-w-none">
        <ContentRenderer :value="data" />
      </UProse>
      <USeparator v-if="surround?.filter(Boolean).length" class="my-8" />
      <UContentSurround v-if="surround?.filter(Boolean).length" :surround="(surround as any)" />
    </UCard>
  </UContainer>
  <div v-else>Document Not Found</div>
</template>
