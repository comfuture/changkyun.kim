<script setup lang="ts">
type CommentNode = {
  id: number
  objectId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
  contentText: string
  url: string
  publishedAt: string | null
  receivedAt: string
  replies: CommentNode[]
}

defineOptions({
  name: 'ActivityPubCommentItem',
})

withDefaults(defineProps<{
  comment: CommentNode
  depth?: number
}>(), {
  depth: 0,
})
</script>

<template>
  <article class="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
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

    <div
      v-if="comment.replies.length"
      class="mt-4 space-y-4 border-l border-gray-200 pl-4 dark:border-gray-800"
    >
      <ActivityPubCommentItem
        v-for="reply in comment.replies"
        :key="reply.objectId"
        :comment="reply"
        :depth="depth + 1"
      />
    </div>
  </article>
</template>
