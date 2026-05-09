<script setup lang="ts">
useSeoMeta({
  title: 'Contact | Changkyun Kim',
  description: 'Email and social profiles for Changkyun Kim',
  ogTitle: 'Contact | Changkyun Kim',
  ogDescription: 'Email and social profiles for Changkyun Kim',
  ogType: 'website',
  ogImage: '/image/cover3.jpg',
  twitterCard: 'summary_large_image',
})

const { style: coverStyle, bind: coverBind } = useImageSrcSet('/image/cover3.jpg', {
  preset: 'cover',
  sizes: 'sm:100vw md:100vw lg:100vw xl:100vw 2xl:100vw',
})

type ContactMethod = {
  label: string
  value?: string
  splitValue?: {
    prefix?: string
    user: string
    domainParts: string[]
  }
  description: string
  actionLabel: string
  to?: string
  encodedHref?: string
  target?: '_blank'
  rel?: string
  icon: string
  badge: string
  iconClass: string
}

const contactMethods: ContactMethod[] = [
  {
    label: 'Email',
    splitValue: {
      user: 'me',
      domainParts: ['changkyun', 'kim'],
    },
    description: '업무 제안이나 비교적 긴 이야기는 메일로 보내주세요.',
    actionLabel: 'Send email',
    encodedHref: 'bWFpbHRvOm1lQGNoYW5na3l1bi5raW0=',
    icon: 'i-lucide-mail',
    badge: 'Email',
    iconClass: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
  },
  {
    label: 'Bluesky',
    value: '@changkyun.kim',
    description: '짧은 공개 대화나 소셜 업데이트는 Bluesky 프로필에서 이어갈 수 있습니다.',
    actionLabel: 'Open profile',
    to: 'https://bsky.app/profile/changkyun.kim',
    target: '_blank',
    rel: 'noopener noreferrer',
    icon: 'i-lucide-cloud',
    badge: 'Social',
    iconClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
  },
  {
    label: 'Fediverse',
    splitValue: {
      prefix: '@',
      user: 'me',
      domainParts: ['changkyun', 'kim'],
    },
    description: 'Mastodon 등 ActivityPub 클라이언트에서 검색할 수 있는 actor입니다. 웹 설명은 About 페이지에서 확인하세요.',
    actionLabel: 'Open about',
    to: '/about',
    icon: 'i-lucide-at-sign',
    badge: 'ActivityPub',
    iconClass: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
  },
  {
    label: 'Kakao Open Chat',
    value: 'Kakao',
    description: '한국어로 빠르게 연락해야 할 때는 카카오 오픈채팅을 사용할 수 있습니다.',
    actionLabel: 'Open chat',
    to: 'https://open.kakao.com/me/changkyunkim',
    target: '_blank',
    rel: 'noopener noreferrer',
    icon: 'i-lucide-message-circle',
    badge: 'Messenger',
    iconClass: 'bg-yellow-400/20 text-yellow-700 dark:text-yellow-300',
  },
]

const openContactMethod = (method: ContactMethod, event: MouseEvent) => {
  if (!method.encodedHref) {
    return
  }

  event.preventDefault()

  if (import.meta.client) {
    window.location.href = window.atob(method.encodedHref)
  }
}
</script>

<template>
  <UPage>
    <main class="pb-16">
      <section
        class="h-48 w-full bg-cover bg-center bg-no-repeat sm:h-56 md:h-64 lg:h-72 xl:h-80"
        v-bind="coverBind"
        :style="coverStyle"
        role="img"
        aria-label="Contact cover"
      />
      <section class="mt-10">
        <div class="container mx-auto px-6 sm:px-8">
          <div class="mx-auto max-w-3xl">
            <h1 class="text-2xl font-semibold tracking-tight text-gray-950 dark:text-white">Contact</h1>
            <p class="mt-3 max-w-2xl text-[15px] leading-7 text-gray-600 dark:text-gray-300">
              아래 방법으로 연락할 수 있습니다. 메일, 소셜 프로필, Fediverse actor, 메신저를 구분해 두었으니
              상황에 맞는 채널을 선택해 주세요.
            </p>

            <div class="mt-8 grid gap-4 sm:grid-cols-2">
              <ULink
                v-for="method in contactMethods"
                :key="method.label"
                raw
                :to="method.encodedHref ? '#' : method.to"
                :target="method.encodedHref ? undefined : method.target"
                :rel="method.encodedHref ? undefined : method.rel"
                @click="openContactMethod(method, $event)"
                class="group flex h-full min-w-0 flex-col gap-4 rounded-lg border border-gray-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-primary-400 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-primary-500"
              >
                <div class="flex min-w-0 items-start gap-4">
                  <span
                    class="flex size-11 shrink-0 items-center justify-center rounded-full"
                    :class="method.iconClass"
                  >
                    <UIcon :name="method.icon" class="size-5" />
                  </span>
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h2 class="text-base font-semibold text-gray-950 dark:text-white">{{ method.label }}</h2>
                      <UBadge color="neutral" variant="subtle" size="sm">{{ method.badge }}</UBadge>
                    </div>
                    <p
                      v-if="method.splitValue"
                      class="mt-1 break-words text-sm font-medium text-primary-600 dark:text-primary-400"
                    >
                      <template v-if="method.splitValue.prefix">
                        <span>{{ method.splitValue.prefix }}</span><span aria-hidden="true" />
                      </template>
                      <span>{{ method.splitValue.user }}</span><span aria-hidden="true" />@<span aria-hidden="true" />
                      <span>{{ method.splitValue.domainParts.join('.') }}</span>
                    </p>
                    <p v-else class="mt-1 break-words text-sm font-medium text-primary-600 dark:text-primary-400">
                      {{ method.value }}
                    </p>
                  </div>
                </div>

                <p class="text-sm leading-6 text-gray-600 dark:text-gray-300">{{ method.description }}</p>

                <span
                  class="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400"
                >
                  {{ method.actionLabel }}
                  <UIcon
                    name="i-lucide-arrow-right"
                    class="size-4 transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </ULink>
            </div>
          </div>
        </div>
      </section>
    </main>
  </UPage>
</template>
