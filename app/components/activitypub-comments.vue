<script setup lang="ts">
type Comment = {
  id: number
  objectId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  contentText: string
  url: string
  publishedAt: string | null
  receivedAt: string
}

const props = defineProps<{
  path: string
  activityUrl: string
}>()

const { data, pending } = await useAsyncData(
  () => `activitypub-comments:${props.path}`,
  () => $fetch<{ comments: Comment[] }>('/api/activitypub/comments', {
    query: { path: props.path },
  }),
  {
    default: () => ({ comments: [] }),
  },
)

const comments = computed(() => data.value?.comments ?? [])
</script>

<template>
  <section class="space-y-6">
    <USeparator />

    <div class="space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          댓글
        </h2>
        <UBadge variant="subtle" color="neutral">
          ActivityPub
        </UBadge>
      </div>

      <div class="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
        <p>
          Mastodon 같은 ActivityPub 클라이언트 검색창에 아래 글 주소를 붙여 넣고, 검색 결과에서 이 글을 연 뒤 답글을 작성하면 이곳에 댓글로 표시됩니다.
        </p>
        <p class="mt-3 break-all font-mono text-xs text-gray-600 dark:text-gray-400">
          {{ activityUrl }}
        </p>
      </div>
    </div>

    <div v-if="pending" class="text-sm text-gray-500">
      댓글을 불러오는 중입니다.
    </div>

    <div v-else-if="comments.length" class="space-y-4">
      <article
        v-for="comment in comments"
        :key="comment.objectId"
        class="rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <div class="flex gap-3">
          <NuxtLink
            :to="comment.actorUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-0.5 shrink-0"
          >
            <UAvatar
              :src="comment.actorIconUrl || undefined"
              :alt="comment.actorName"
              size="md"
            />
          </NuxtLink>
          <div class="min-w-0 flex-1 space-y-2">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <NuxtLink
                :to="comment.actorUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="font-medium text-gray-900 hover:underline dark:text-gray-100"
              >
                {{ comment.actorName }}
              </NuxtLink>
              <NuxtLink
                :to="comment.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-gray-500 hover:underline"
              >
                <ui-datetime :datetime="comment.publishedAt || comment.receivedAt" />
              </NuxtLink>
            </div>
            <p class="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-200">
              {{ comment.contentText }}
            </p>
          </div>
        </div>
      </article>
    </div>

    <p v-else class="text-sm text-gray-500">
      아직 받은 ActivityPub 댓글이 없습니다.
    </p>
  </section>
</template>
