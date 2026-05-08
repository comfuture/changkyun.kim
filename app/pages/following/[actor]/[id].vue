<script setup lang="ts">
type FeedPost = {
  id: number
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  actorSlug: string
  contentText: string
  name: string | null
  objectType: string
  publishedAt: string
  receivedAt: string
  source: string
  url: string
}

const route = useRoute()
const actorSlug = computed(() => String(route.params.actor ?? ''))
const postId = computed(() => Number.parseInt(String(route.params.id ?? ''), 10))

const { data } = await useFetch<{ post: FeedPost }>(() => `/api/activitypub/feed/${postId.value}`)
const post = computed(() => data.value?.post ?? null)

if (!post.value || post.value.actorSlug !== actorSlug.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'ActivityPub feed post not found.',
  })
}

useSeoMeta({
  title: () => `${post.value?.name || post.value?.actorName || 'Following'} | Changkyun Kim`,
  description: () => post.value?.contentText.slice(0, 160) || 'ActivityPub post.',
  ogTitle: () => post.value?.name || post.value?.actorName || 'Following',
  ogDescription: () => post.value?.contentText.slice(0, 160) || 'ActivityPub post.',
  ogType: 'article',
  twitterCard: 'summary',
})

function hostFromUrl(value: string): string {
  try {
    return new URL(value).host
  } catch {
    return value
  }
}
</script>

<template>
  <UPage>
    <main class="container mx-auto px-6 py-12 sm:px-8">
      <article v-if="post" class="max-w-3xl">
        <UButton to="/following/" variant="link" class="mb-8 p-0">
          Following
        </UButton>

        <header class="flex gap-3">
          <UAvatar
            :src="post.actorIconUrl || undefined"
            :alt="post.actorName"
            :text="post.actorName.slice(0, 1)"
            size="md"
            class="mt-1 shrink-0"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <NuxtLink :to="post.actorUrl" external class="font-medium text-gray-900 hover:underline dark:text-gray-100">
                {{ post.actorName }}
              </NuxtLink>
              <span class="text-gray-400">{{ hostFromUrl(post.actorUrl) }}</span>
              <span class="text-gray-300 dark:text-gray-700">/</span>
              <ui-datetime class="text-gray-500 dark:text-gray-400" :datetime="post.publishedAt" />
            </div>
            <h1 v-if="post.name" class="mt-4 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
              {{ post.name }}
            </h1>
          </div>
        </header>

        <div class="mt-8 whitespace-pre-line text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">
          {{ post.contentText }}
        </div>

        <footer class="mt-8 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
          <UButton :to="post.url" external variant="outline" size="sm">
            Open original
          </UButton>
          <span>{{ post.objectType }}</span>
          <span>{{ post.source }}</span>
        </footer>
      </article>
    </main>
  </UPage>
</template>
