<script setup lang="ts">
type ArticleCardVariant = 'featured' | 'grid' | 'list-featured' | 'list'

type ArticleCardArticle = {
  id?: string
  path?: string
  title?: string
  description?: string
  createdAt?: string | Date
  coverImage?: string
}

const props = withDefaults(defineProps<{
  article: ArticleCardArticle
  variant?: ArticleCardVariant
  eager?: boolean
}>(), {
  variant: 'grid',
  eager: false,
})

const target = computed(() => props.article.path || '/blog/')
const description = computed(() => props.article.description?.trim() || '')
const hasImage = computed(() => Boolean(props.article.coverImage))

const formattedDate = computed(() => {
  if (!props.article.createdAt) {
    return ''
  }

  const date = new Date(props.article.createdAt)
  if (Number.isNaN(date.getTime())) {
    return String(props.article.createdAt)
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
})

const imageLoading = computed(() => props.eager ? 'eager' : 'lazy')

const rootClass = computed(() => {
  if (props.variant === 'featured') {
    return [
      'group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-lg dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-primary-700',
      'min-w-0 max-w-full',
      hasImage.value ? 'md:grid md:min-h-[320px] md:grid-cols-[minmax(0,0.95fr)_minmax(280px,1.05fr)]' : '',
    ]
  }

  if (props.variant === 'list-featured') {
    return [
      'group grid overflow-hidden rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-primary-700',
      'min-w-0 max-w-full',
      hasImage.value ? 'gap-5 md:grid-cols-[260px_minmax(0,1fr)]' : '',
    ]
  }

  if (props.variant === 'list') {
    return [
      'group grid overflow-hidden rounded-lg border border-gray-200 bg-white p-4 transition duration-200 hover:border-primary-300 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-primary-700',
      'min-w-0 max-w-full',
      hasImage.value ? 'gap-5 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-center' : '',
    ]
  }

  return [
    'group flex h-full min-h-[220px] flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-md dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-primary-700',
    'min-w-0 max-w-full',
    hasImage.value ? '' : 'justify-between',
  ]
})
</script>

<template>
  <ULink
    :to="target"
    :class="rootClass"
    :aria-label="article.title ? `Read ${article.title}` : 'Read article'"
  >
    <template v-if="variant === 'featured'">
      <div class="flex min-h-[280px] flex-col justify-between p-6 sm:p-8">
        <div>
          <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">
            <span>Latest</span>
            <span v-if="formattedDate" class="text-gray-400 dark:text-gray-500">/</span>
            <time v-if="formattedDate">{{ formattedDate }}</time>
          </div>
          <h2 class="mt-4 break-words text-2xl font-semibold leading-tight tracking-tight text-gray-950 group-hover:text-primary-600 sm:text-3xl dark:text-white dark:group-hover:text-primary-400">
            {{ article.title }}
          </h2>
          <p v-if="description" class="mt-4 line-clamp-4 break-words text-base leading-7 text-gray-600 dark:text-gray-300">
            {{ description }}
          </p>
        </div>
        <span class="mt-8 inline-flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400">
          Read article
          <UIcon name="i-lucide-arrow-right" class="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      <div v-if="hasImage" class="order-first h-64 overflow-hidden md:order-none md:h-full md:min-h-[320px]">
        <NuxtImg
          :src="article.coverImage"
          :alt="article.title || ''"
          :loading="imageLoading"
          sizes="sm:100vw md:50vw lg:520px"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
    </template>

    <template v-else-if="variant === 'list-featured'">
      <div v-if="hasImage" class="aspect-[16/10] overflow-hidden rounded-md md:aspect-auto md:min-h-48">
        <NuxtImg
          :src="article.coverImage"
          :alt="article.title || ''"
          :loading="imageLoading"
          sizes="sm:100vw md:260px"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div class="flex min-w-0 flex-col justify-center py-1">
        <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">
          <span>Latest</span>
          <span v-if="formattedDate" class="text-gray-400 dark:text-gray-500">/</span>
          <time v-if="formattedDate">{{ formattedDate }}</time>
        </div>
        <h2 class="mt-3 line-clamp-2 break-words text-2xl font-semibold leading-tight tracking-tight text-gray-950 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {{ article.title }}
        </h2>
        <p v-if="description" class="mt-3 line-clamp-3 break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
          {{ description }}
        </p>
      </div>
    </template>

    <template v-else-if="variant === 'list'">
      <div v-if="hasImage" class="aspect-[4/3] w-full overflow-hidden rounded-md">
        <NuxtImg
          :src="article.coverImage"
          :alt="article.title || ''"
          :loading="imageLoading"
          sizes="sm:120px md:120px"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div class="flex min-w-0 flex-col justify-center">
        <time v-if="formattedDate" class="text-xs text-gray-500 dark:text-gray-400">{{ formattedDate }}</time>
        <h2 class="mt-2 line-clamp-2 break-words text-base font-semibold leading-snug text-gray-950 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {{ article.title }}
        </h2>
        <p v-if="description" class="mt-2 line-clamp-2 break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
          {{ description }}
        </p>
      </div>
    </template>

    <template v-else>
      <div v-if="hasImage" class="aspect-[16/10] overflow-hidden">
        <NuxtImg
          :src="article.coverImage"
          :alt="article.title || ''"
          :loading="imageLoading"
          sizes="sm:100vw md:50vw lg:380px"
          class="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      </div>
      <div class="flex flex-1 flex-col p-5">
        <time v-if="formattedDate" class="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{{ formattedDate }}</time>
        <h3 class="mt-3 line-clamp-2 break-words text-lg font-semibold leading-snug text-gray-950 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
          {{ article.title }}
        </h3>
        <p v-if="description" class="mt-3 line-clamp-3 break-words text-sm leading-6 text-gray-600 dark:text-gray-300">
          {{ description }}
        </p>
        <span class="mt-auto pt-5 text-xs font-medium uppercase tracking-wide text-primary-600 dark:text-primary-400">
          Article
        </span>
      </div>
    </template>
  </ULink>
</template>
