<script setup lang="ts">
const route = useRoute()
const { data } = await useAsyncData(route.path, () => queryCollection('blog').path(route.path).first())
const { data: surround } = await useAsyncData(`${route.path}-surround`, () => {
  return queryCollectionItemSurroundings('blog', route.path, {
    fields: ['title', 'description'],
  })
})
const img = useImage()
const coverStyle = computed(() => {
  if (!data.value?.coverImage) return
  return {
    backgroundImage: `url('${img(data.value.coverImage, {}, { preset: 'cover' })}')`,
  }
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
      class="h-56 w-full bg-cover bg-center bg-no-repeat sm:h-72 md:h-80 lg:h-96"
      :style="coverStyle"
      role="img"
      :aria-label="data.title"
    />
    <section class="mt-10">
      <div class="container mx-auto px-2 sm:px-4">
        <UPage class="lg:gap-12">
          <template #right>
            <UPageAside class="lg:ps-2">
              <UContentToc v-if="data?.body?.toc?.links?.length" class="lg:sticky lg:top-24" :links="data.body.toc.links" />
            </UPageAside>
          </template>
          <UPageBody class="mt-0 pb-20 space-y-10">
            <section class="space-y-4">
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                <ui-datetime :datetime="data.createdAt" />
                <div class="flex flex-wrap gap-2" v-if="data.tags">
                  <UBadge v-for="tag in data.tags" :key="tag" variant="subtle" color="primary">
                    {{ tag }}
                  </UBadge>
                </div>
              </div>
              <h1 class="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
                {{ data.title }}
              </h1>
              <p v-if="data.description" class="max-w-2xl text-base text-gray-600 dark:text-gray-300">
                {{ data.description }}
              </p>
            </section>
            <section
              class="max-w-none text-[15px] leading-relaxed text-gray-700 dark:text-gray-200 [&_h2]:!mt-10 [&_h2]:!text-2xl [&_h2]:!font-semibold [&_h2]:!tracking-tight [&_h3]:!mt-8 [&_h3]:!text-xl [&_h3]:!font-semibold [&_h2_a]:!text-current [&_h2_a]:no-underline [&_h2_a:hover]:no-underline [&_h2_a]:!border-0 [&_h2_a:hover]:!border-0 [&_h3_a]:!text-current [&_h3_a]:no-underline [&_h3_a:hover]:no-underline [&_h3_a]:!border-0 [&_h3_a:hover]:!border-0 [&_h4_a]:!text-current [&_h4_a]:no-underline [&_h4_a:hover]:no-underline [&_h4_a]:!border-0 [&_h4_a:hover]:!border-0 [&_p]:mt-4 [&_p]:text-[15px] [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul>li]:my-1 [&_ol>li]:my-1 [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_pre]:my-6 [&_pre]:rounded-lg [&_pre]:!bg-neutral-950 [&_pre]:!border-neutral-800 [&_pre]:p-4 dark:[&_pre]:!bg-neutral-900 dark:[&_pre]:!border-neutral-700 [&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-neutral-100 [&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-neutral-800 dark:[&_code]:bg-neutral-800 dark:[&_code]:text-neutral-100 [&_a]:text-primary-600 [&_a]:no-underline [&_a]:underline-offset-4 [&_a:hover]:underline [&_img]:my-6 [&_img]:rounded-lg"
            >
              <ContentRenderer :value="data" />
            </section>
            <USeparator v-if="surround?.filter(Boolean).length" class="my-8" />
            <UContentSurround v-if="surround?.filter(Boolean).length" :surround="(surround as any)" />
          </UPageBody>
        </UPage>
      </div>
    </section>
  </div>
</template>
