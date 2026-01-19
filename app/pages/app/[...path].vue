<script setup lang="ts">
const { path } = useRoute()
const { data } = await useAsyncData(() => queryCollection('app').path(path).first())

useSeoMeta({
  title: data.value?.title,
  description: data.value?.description,
})
</script>
<template>
  <UContainer class="py-10" v-if="data">
    <UCard class="overflow-hidden" v-if="data.coverImage">
      <nuxt-img preset="cover" class="w-full object-cover" :src="data.coverImage" :alt="data.title" />
    </UCard>
    <UCard class="mt-6 p-6 md:p-8">
      <header class="space-y-3">
        <h1 class="text-2xl font-semibold">{{ data.title }}</h1>
        <ui-datetime :datetime="data.createdAt" />
        <div class="flex flex-wrap gap-2" v-if="data.tags">
          <UBadge v-for="tag in data.tags" :key="tag" variant="subtle" color="primary">
            {{ tag }}
          </UBadge>
        </div>
      </header>
      <UProse class="mt-6 max-w-none">
        <content-renderer :value="data" />
      </UProse>
    </UCard>
  </UContainer>
  <div v-else>Document Not Found</div>
</template>
