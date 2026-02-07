<script setup lang="ts">
const { params: { tag } } = useRoute()

useSeoMeta({
  title: `Tag: ${tag} | Changkyun Kim`,
  description: 'blog | Changkyun Kim',
  ogTitle: `Tag: ${tag} | Changkyun Kim`,
  ogDescription: 'blog | Changkyun Kim',
  ogType: 'website',
  twitterCard: 'summary',
})
</script>
<template>
  <UPage>
    <UContainer>
      <main>
        <section class="px-6 sm:px-8">
          <h2 class="text-xl font-semibold">{{ tag }}에 대한 글들</h2>
          <p class="mt-2 text-sm text-gray-500">
            {{ tag }} ...
          </p>
        </section>
      </main>
    </UContainer>
  </UPage>
</template>
