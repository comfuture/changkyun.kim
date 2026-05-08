<script setup lang="ts">
type Reaction = {
  reaction: string
  count: number
}

const props = defineProps<{
  path: string
}>()

const { data } = await useAsyncData(
  () => `activitypub-reactions:${props.path}`,
  () => $fetch<{ reactions: Reaction[] }>('/api/activitypub/reactions', {
    query: { path: props.path },
  }),
  {
    default: () => ({ reactions: [] }),
  },
)

const reactions = computed(() => data.value?.reactions ?? [])
</script>

<template>
  <section v-if="reactions.length" class="flex flex-wrap items-center gap-3 text-sm">
    <h2 class="font-medium text-gray-700 dark:text-gray-200">
      반응
    </h2>
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="reaction in reactions"
        :key="reaction.reaction"
        class="inline-flex h-8 items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-100"
      >
        <span>{{ reaction.reaction }}</span>
        <span v-if="reaction.count > 1" class="font-medium tabular-nums">
          {{ reaction.count }}
        </span>
      </li>
    </ul>
  </section>
</template>
