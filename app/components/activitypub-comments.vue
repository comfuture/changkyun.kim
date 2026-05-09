<script setup lang="ts">
import ActivityPubCommentItem from './activitypub-comment-item.vue'

type Comment = {
  id: number
  objectId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  contentText: string
  url: string
  replyTargetId: string | null
  publishedAt: string | null
  receivedAt: string
}

type CommentNode = Comment & {
  replies: CommentNode[]
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
const threadedComments = computed<CommentNode[]>(() => {
  const nodes = new Map<string, CommentNode>()
  const roots: CommentNode[] = []

  for (const comment of comments.value) {
    nodes.set(comment.objectId, {
      ...comment,
      replies: [],
    })
  }

  for (const comment of comments.value) {
    const node = nodes.get(comment.objectId)
    if (!node) {
      continue
    }

    const parent = comment.replyTargetId ? nodes.get(comment.replyTargetId) : null
    if (parent && parent.objectId !== node.objectId) {
      parent.replies.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
})
const copied = ref(false)
let copiedResetTimer: ReturnType<typeof setTimeout> | undefined

const copyActivityUrl = async () => {
  if (!import.meta.client || !props.activityUrl) {
    return
  }

  await navigator.clipboard.writeText(props.activityUrl)
  copied.value = true
  clearTimeout(copiedResetTimer)
  copiedResetTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

onBeforeUnmount(() => {
  clearTimeout(copiedResetTimer)
})
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
        <div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <p class="min-w-0 flex-1 break-all rounded-md bg-white px-3 py-2 font-mono text-xs text-gray-600 dark:bg-gray-950/60 dark:text-gray-400">
            {{ activityUrl }}
          </p>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
            :label="copied ? '복사됨' : 'URL 복사'"
            :aria-label="copied ? 'URL이 복사되었습니다' : '댓글용 URL 복사'"
            @click="copyActivityUrl"
          />
        </div>
      </div>
    </div>

    <div v-if="pending" class="text-sm text-gray-500">
      댓글을 불러오는 중입니다.
    </div>

    <div v-else-if="threadedComments.length" class="space-y-4">
      <ActivityPubCommentItem
        v-for="comment in threadedComments"
        :key="comment.objectId"
        :comment="comment"
      />
    </div>

    <p v-else class="text-sm text-gray-500">
      아직 받은 ActivityPub 댓글이 없습니다.
    </p>
  </section>
</template>
