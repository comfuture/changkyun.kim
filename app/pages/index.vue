<script setup lang="ts">
const { data: recent } = await useAsyncData('recentArticles', () =>
  queryCollection('blog')
    .select('id', 'path', 'title', 'createdAt')
    .order('createdAt', 'DESC')
    .limit(5)
    .all()
)
</script>
<template>
  <UPage>
    <UContainer>
      <main>
        <section class="space-y-6">
          <nuxt-img preset="cover" src="/image/cover2.jpg" alt="cover image" class="h-64 w-full object-cover" />
          <div class="px-6 sm:px-8">
            <UBadge variant="subtle" color="primary">Welcome</UBadge>
            <p class="mt-4 text-lg text-gray-600 dark:text-gray-300">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed ut purus eget nunc ultrices lacinia. Nullam nec
            </p>
          </div>
        </section>

        <UPageSection>
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-xl font-semibold">Recent articles</h2>
            <UButton to="/blog/" variant="ghost" size="sm">View all</UButton>
          </div>
          <ul class="mt-4 space-y-2" v-if="recent">
            <li v-for="item in recent" :key="item.id">
              <UButton :to="item.path" variant="link" class="p-0 text-left">
                {{ item.title }}
              </UButton>
            </li>
          </ul>
        </UPageSection>
      </main>
    </UContainer>
  </UPage>
</template>
