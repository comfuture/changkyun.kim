<script setup lang="ts">
import { normalizeRoutePath } from '~/composables/normalizeRoutePath'
import { siteIdentity, siteKeywords } from '~/utils/siteIdentity'

const route = useRoute()
const contentPath = computed(() => normalizeRoutePath(route.path))

const { data: payload, pending } = useAsyncData(
  () => `blog-entry:${contentPath.value}`,
  () => $fetch('/api/blog/article', {
    query: { path: contentPath.value },
  }),
  {
    lazy: true,
  },
)

const payloadPath = computed(() => payload.value?.article?.path ? normalizeRoutePath(payload.value.article.path) : '')
const data = computed(() => payloadPath.value === contentPath.value ? payload.value?.article || null : null)
const isLoadingArticle = computed(() => pending.value && !data.value)
const surround = computed(() => payload.value?.surround || [])
const resolvedPath = computed(() => normalizeRoutePath(data.value?.path || contentPath.value))
const coverImage = computed(() => data.value?.coverImage)
const activityUrl = computed(() => data.value?.path ? `https://changkyun.kim${resolvedPath.value}/activity` : null)
const canonicalActivityUrl = computed(() => data.value?.path ? `https://changkyun.kim${resolvedPath.value}` : '')
const articleDescription = computed(() => data.value?.description || `${data.value?.title || 'Blog article'}에 대한 기록입니다.`)
const { style: coverStyle, bind: coverBind } = useImageSrcSet(coverImage, {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})

useSeoMeta({
  title: () => data.value?.title
    ? `${data.value.title} | Changkyun Kim`
    : isLoadingArticle.value ? 'Loading | Changkyun Kim' : 'Document Not Found | Changkyun Kim',
  description: () => articleDescription.value,
  author: `${siteIdentity.koreanName}, ${siteIdentity.legalName}`,
  ogTitle: () => data.value?.title || 'Changkyun Kim Blog',
  ogDescription: () => articleDescription.value,
  ogType: 'article',
  twitterCard: 'summary_large_image',
})
useSiteOgImageMeta({
  image: () => data.value?.coverImage,
  alt: () => data.value?.title || 'Changkyun Kim Blog',
})

useHead(() => ({
  link: activityUrl.value
    ? [
        {
          rel: 'alternate',
          type: 'application/activity+json',
          href: activityUrl.value,
        },
      ]
    : [],
  meta: [
    {
      name: 'keywords',
      content: [...siteKeywords, ...(data.value?.tags || [])].join(', '),
    },
    ...(data.value
      ? [
        { property: 'article:author', content: '김창균 Changkyun Kim' },
        { property: 'article:published_time', content: data.value.createdAt },
        ...(data.value.tags || []).map(tag => ({ property: 'article:tag', content: tag })),
      ]
      : []),
  ],
  script: data.value
    ? [
        {
          key: 'blog-article-json-ld',
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: data.value.title,
            description: articleDescription.value,
            image: data.value.coverImage ? `https://changkyun.kim${data.value.coverImage}` : 'https://changkyun.kim/image/article-cover.jpg',
            datePublished: data.value.createdAt,
            author: {
              '@type': 'Person',
              '@id': 'https://changkyun.kim/#person',
              name: siteIdentity.koreanName,
              alternateName: siteIdentity.legalName,
            },
            publisher: {
              '@id': 'https://changkyun.kim/#person',
            },
            mainEntityOfPage: canonicalActivityUrl.value,
            inLanguage: 'ko-KR',
            keywords: [...siteKeywords, ...(data.value.tags || [])],
          }),
        },
      ]
    : [],
}))

</script>
<template>
  <div>
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
                <div v-if="data.tags" class="flex flex-wrap gap-2">
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
              class="blog-content content-body max-w-none text-[15px] leading-relaxed text-gray-700 dark:text-gray-200 [&_h2]:!mt-10 [&_h2]:!text-2xl [&_h2]:!font-semibold [&_h2]:!tracking-tight [&_h3]:!mt-8 [&_h3]:!text-xl [&_h3]:!font-semibold [&_h2_a]:!text-current [&_h2_a]:no-underline [&_h2_a:hover]:no-underline [&_h2_a]:!border-0 [&_h2_a:hover]:!border-0 [&_h3_a]:!text-current [&_h3_a]:no-underline [&_h3_a:hover]:no-underline [&_h3_a]:!border-0 [&_h3_a:hover]:!border-0 [&_h4_a]:!text-current [&_h4_a]:no-underline [&_h4_a:hover]:no-underline [&_h4_a]:!border-0 [&_h4_a:hover]:!border-0 [&_p]:mt-4 [&_p]:text-[15px] [&_p]:leading-relaxed [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul>li]:my-1 [&_ol>li]:my-1 [&_blockquote]:my-6 [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:text-gray-600 [&_a]:text-primary-600 [&_a]:no-underline [&_a]:underline-offset-4 [&_a:hover]:underline [&_img]:my-6 [&_img]:rounded-lg"
            >
              <ContentRenderer :value="data" />
            </section>
            <ClientOnly>
              <ActivitypubReactions
                :path="resolvedPath"
              />
              <ActivitypubComments
                :path="resolvedPath"
                :activity-url="canonicalActivityUrl"
              />
            </ClientOnly>
            <USeparator v-if="surround?.filter(Boolean).length" class="my-8" />
            <UContentSurround v-if="surround?.filter(Boolean).length" :surround="(surround as any)" />
          </UPageBody>
        </UPage>
      </div>
    </section>
    </div>
    <div v-else-if="isLoadingArticle" class="container mx-auto px-2 py-10 sm:px-4">
      <USkeleton class="h-48 w-full rounded-none sm:h-56 md:h-64 lg:h-72 xl:h-80" />
      <div class="mx-auto mt-10 max-w-4xl space-y-8">
        <div class="space-y-4">
          <USkeleton class="h-4 w-40" />
          <USkeleton class="h-10 w-3/4" />
          <USkeleton class="h-5 w-1/2" />
        </div>
        <div class="space-y-3">
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-11/12" />
          <USkeleton class="h-4 w-5/6" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-2/3" />
        </div>
      </div>
    </div>
    <div v-else class="container mx-auto px-6 py-16 text-sm text-gray-500 sm:px-8">
      Document Not Found
    </div>
  </div>
</template>

<style scoped>
.blog-content :deep(a) {
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
