<script setup lang="ts">
type FeedPost = {
  id: number
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  contentText: string
  name: string | null
  publishedAt: string
  routePath: string
  source: string
  url: string
}

useSeoMeta({
  title: 'Following | Changkyun Kim',
  description: 'ActivityPub posts from connected Fediverse actors.',
  ogTitle: 'Following | Changkyun Kim',
  ogDescription: 'ActivityPub posts from connected Fediverse actors.',
  ogType: 'website',
  twitterCard: 'summary',
})

const { data } = await useFetch<{ posts: FeedPost[] }>('/api/activitypub/feed', {
  query: { limit: 50 },
  default: () => ({ posts: [] }),
})

const posts = computed(() => data.value?.posts ?? [])

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
      <section class="max-w-3xl">
        <h1 class="text-2xl font-semibold tracking-tight">Following</h1>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Public ActivityPub posts from actors connected with @me@changkyun.kim.
        </p>
      </section>

      <ul v-if="posts.length" class="mt-8 max-w-3xl divide-y divide-gray-200 dark:divide-gray-800">
        <li v-for="post in posts" :key="post.id" class="py-6">
          <article class="flex gap-3">
            <UAvatar
              :src="post.actorIconUrl || undefined"
              :alt="post.actorName"
              :text="post.actorName.slice(0, 1)"
              size="sm"
              class="mt-1 shrink-0"
            />
            <div class="min-w-0 flex-1 space-y-2">
              <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <NuxtLink :to="post.routePath" class="font-medium text-gray-900 hover:underline dark:text-gray-100">
                  {{ post.actorName }}
                </NuxtLink>
                <span class="text-gray-400">{{ hostFromUrl(post.actorUrl) }}</span>
                <span class="text-gray-300 dark:text-gray-700">/</span>
                <ui-datetime class="text-gray-500 dark:text-gray-400" :datetime="post.publishedAt" />
              </div>
              <NuxtLink
                v-if="post.name"
                :to="post.routePath"
                class="block text-base font-medium text-gray-900 hover:underline dark:text-gray-100"
              >
                {{ post.name }}
              </NuxtLink>
              <p class="whitespace-pre-line text-[15px] leading-relaxed text-gray-700 dark:text-gray-200">
                {{ post.contentText }}
              </p>
              <div class="pt-1">
                <UButton :to="post.routePath" variant="link" class="p-0">
                  Read
                </UButton>
              </div>
            </div>
          </article>
        </li>
      </ul>

      <p v-else class="mt-8 text-sm text-gray-500 dark:text-gray-400">
        No remote posts have been received yet.
      </p>
    </main>
  </UPage>
</template>
