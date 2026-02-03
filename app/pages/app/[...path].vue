<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(route.path, () => queryCollection('app').path(route.path).first())
const { data: surround } = await useAsyncData(`${route.path}-surround`, () => {
  return queryCollectionItemSurroundings('app', route.path, {
    fields: ['title', 'description'],
  })
})
const coverImage = computed(() => data.value?.coverImage)
const { style: coverStyle, bind: coverBind } = useImageSrcSet(coverImage, {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})

useSeoMeta({
  title: data.value?.title,
  description: data.value?.description,
})
</script>
<template>
  <div v-if="data">
    <section
      v-if="data.coverImage"
      class="h-48 w-full bg-cover bg-center bg-no-repeat sm:h-56 md:h-64 lg:h-72 xl:h-80"
      v-bind="coverBind"
      :style="coverStyle"
      role="img"
      :aria-label="data.title"
    />
    <section class="mt-10">
      <div class="container mx-auto px-2 sm:px-4">
        <UPage>
          <UPageBody class="mt-0">
            <section>
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
              <div class="prose mt-6 max-w-none">
                <ContentRenderer :value="data" />
              </div>
              <USeparator v-if="surround?.filter(Boolean).length" class="my-8" />
              <UContentSurround v-if="surround?.filter(Boolean).length" :surround="(surround as any)" />
            </section>
          </UPageBody>
        </UPage>
      </div>
    </section>
  </div>
  <div v-else>Document Not Found</div>
</template>
