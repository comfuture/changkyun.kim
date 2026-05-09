<script setup lang="ts">
type ReactionActor = {
  actorId: string
  actorName: string
  actorUrl: string
  actorIconUrl: string | null
}

type Reaction = {
  reaction: string
  count: number
  actors: ReactionActor[]
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
const expandedReactionActors = ref<Set<string>>(new Set())

function visibleActors(reaction: Reaction): ReactionActor[] {
  return expandedReactionActors.value.has(reaction.reaction)
    ? reaction.actors
    : reaction.actors.slice(0, 10)
}

function expandActors(reaction: string) {
  expandedReactionActors.value = new Set(expandedReactionActors.value).add(reaction)
}
</script>

<template>
  <section v-if="reactions.length" class="flex flex-wrap items-center gap-3 text-sm">
    <h2 class="font-medium text-gray-700 dark:text-gray-200">
      반응
    </h2>
    <div class="flex flex-wrap gap-2">
      <UPopover
        v-for="reaction in reactions"
        :key="reaction.reaction"
        mode="hover"
        arrow
        :open-delay="100"
        :close-delay="150"
        :content="{ align: 'center', side: 'right', sideOffset: 8 }"
        :ui="{ content: 'w-64 p-2' }"
      >
        <button
          type="button"
          :aria-label="`${reaction.reaction} reaction actors`"
          class="inline-flex h-8 cursor-default items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-100"
        >
          <span>{{ reaction.reaction }}</span>
          <span v-if="reaction.count > 1" class="font-medium tabular-nums">
            {{ reaction.count }}
          </span>
        </button>

        <template #content>
          <div class="max-h-[24rem] overflow-y-auto">
            <ul class="space-y-1">
              <li
                v-for="actor in visibleActors(reaction)"
                :key="actor.actorId"
              >
                <NuxtLink
                  :to="actor.actorUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <UAvatar
                    :src="actor.actorIconUrl || undefined"
                    :alt="actor.actorName"
                    size="xs"
                    class="shrink-0"
                  />
                  <span class="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">
                    {{ actor.actorName }}
                  </span>
                </NuxtLink>
              </li>
            </ul>
            <button
              v-if="reaction.actors.length > 10 && !expandedReactionActors.has(reaction.reaction)"
              type="button"
              class="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              @click="expandActors(reaction.reaction)"
            >
              ...more
            </button>
          </div>
        </template>
      </UPopover>
    </div>
  </section>
</template>
